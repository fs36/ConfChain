import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PaperStatus, Role } from "@prisma/client";
import { createHash } from "crypto";
import { BlockchainService } from "../blockchain/blockchain.service";
import { ConfConfigService } from "../conf-config/conf-config.service";
import { PrismaService } from "../common/prisma.service";
import { AssignReviewDto } from "./dto/assign-review.dto";
import { SubmitReviewDto } from "./dto/submit-review.dto";

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
    private readonly confConfigService: ConfConfigService,
  ) {}

  async assign(dto: AssignReviewDto) {
    const paper = await this.prisma.paper.findUnique({ where: { id: dto.paperId } });
    if (!paper) throw new NotFoundException("Paper not found");

    const tasks = await this.prisma.$transaction(
      dto.reviewerIds.map((reviewerId) =>
        this.prisma.reviewTask.create({
          data: {
            paperId: dto.paperId,
            reviewerId,
            deadlineAt: new Date(dto.deadlineAt),
          },
        }),
      ),
    );
    await this.prisma.paper.update({
      where: { id: dto.paperId },
      data: { status: PaperStatus.UNDER_REVIEW },
    });
    return tasks;
  }

  async submit(reviewerId: string, dto: SubmitReviewDto) {
    const task = await this.prisma.reviewTask.findFirst({
      where: { id: dto.taskId, reviewerId },
      include: { reviewer: true },
    });
    if (!task) throw new NotFoundException("Review task not found");

    const commentCipher = createHash("sha256").update(dto.comment).digest("hex");

    // 上链（失败降级）
    const onchain = await this.blockchainService.submitReview({
      paperId: task.paperId,
      reviewerAddress: task.reviewer.walletAddr ?? "0x0",
      score: dto.score,
      recommendation: dto.recommendation,
      commentHash: commentCipher,
    });

    const result = await this.prisma.reviewResult.create({
      data: {
        paperId: task.paperId,
        reviewerId,
        score: dto.score,
        recommendation: dto.recommendation,
        commentCipher,
        txHash: onchain.txHash,
      },
    });

    await this.prisma.reviewTask.update({
      where: { id: task.id },
      data: { status: "SUBMITTED", assignTxHash: onchain.txHash },
    });

    await this.prisma.chainTransaction.create({
      data: {
        bizType: "REVIEW_SUBMIT",
        bizId: task.paperId,
        txHash: onchain.txHash,
        blockHeight: onchain.blockHeight,
        payload: {
          taskId: task.id,
          score: dto.score,
          recommendation: dto.recommendation,
          simulated: onchain.simulated,
        },
      },
    });

    return { ...result, simulated: onchain.simulated };
  }

  async adjudicate(paperId: string) {
    const results = await this.prisma.reviewResult.findMany({ where: { paperId } });
    if (results.length === 0) throw new NotFoundException("No reviews found for this paper");

    const total = results.reduce((sum, item) => sum + item.score, 0);
    const avg = Math.round((total / results.length) * 100) / 100;
    const threshold = await this.confConfigService.getThreshold();

    let status: PaperStatus = PaperStatus.REJECTED;
    if (avg >= threshold + 10) status = PaperStatus.ACCEPTED;
    else if (avg >= threshold) status = PaperStatus.REVISION;

    await this.prisma.paper.update({
      where: { id: paperId },
      data: { status },
    });

    // 裁定结果上链
    const onchain = await this.blockchainService.finalizeDecision({
      paperId,
      decision: status,
    });

    await this.prisma.chainTransaction.create({
      data: {
        bizType: "ADJUDICATE",
        bizId: paperId,
        txHash: onchain.txHash,
        blockHeight: onchain.blockHeight,
        payload: { averageScore: avg, finalStatus: status, simulated: onchain.simulated },
      },
    });

    return {
      paperId,
      averageScore: avg,
      threshold,
      finalStatus: status,
      txHash: onchain.txHash,
      simulated: onchain.simulated,
    };
  }

  myTasks(reviewerId: string) {
    return this.prisma.reviewTask.findMany({
      where: { reviewerId },
      include: {
        paper: {
          select: {
            id: true,
            title: true,
            keywords: true,
            status: true,
            abstract: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * 管理员查看稿件详情（论文信息 + 审稿意见汇总）
   */
  async getPaperDetailForAdmin(paperId: string) {
    const paper = await this.prisma.paper.findUnique({
      where: { id: paperId },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
    if (!paper) throw new NotFoundException("Paper not found");
    const results = await this.getResults(paperId);
    return { paper, results };
  }

  /**
   * 管理员查看某篇稿件的所有审稿意见汇总
   * 审稿人身份匿名（不返回 reviewerId）
   */
  async getResults(paperId: string) {
    const results = await this.prisma.reviewResult.findMany({
      where: { paperId },
      select: {
        id: true,
        score: true,
        recommendation: true,
        txHash: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
    const avg =
      results.length > 0
        ? Math.round((results.reduce((s, r) => s + r.score, 0) / results.length) * 100) / 100
        : null;
    return { paperId, count: results.length, averageScore: avg, results };
  }

  /**
   * 审稿人获取脱敏稿件详情（仅标题/摘要/关键词，无作者信息）
   * 必须已被分配到该稿件
   */
  async getPaperForReviewer(paperId: string, reviewerId: string) {
    const task = await this.prisma.reviewTask.findFirst({
      where: { paperId, reviewerId },
    });
    if (!task) throw new ForbiddenException("您未被分配到该稿件");

    return this.prisma.paper.findUnique({
      where: { id: paperId },
      select: {
        id: true,
        title: true,
        abstract: true,
        keywords: true,
        createdAt: true,
      },
    });
  }

  /**
   * 自动分配审稿人（轻量负载均衡：按已有任务数最少优先）
   */
  async autoAssign(dto: { paperId: string; count: number; deadlineAt: string }) {
    const paper = await this.prisma.paper.findUnique({ where: { id: dto.paperId } });
    if (!paper) throw new NotFoundException("Paper not found");

    const existing = await this.prisma.reviewTask.findMany({
      where: { paperId: dto.paperId },
      select: { reviewerId: true },
    });
    const existingIds = existing.map((t) => t.reviewerId);

    const reviewers = await this.prisma.user.findMany({
      where: { role: Role.REVIEWER, id: { notIn: existingIds } },
      include: { _count: { select: { reviewTasks: true } } },
      orderBy: { reviewTasks: { _count: "asc" } },
      take: dto.count,
    });

    if (reviewers.length === 0) throw new NotFoundException("No available reviewers");

    return this.assign({
      paperId: dto.paperId,
      reviewerIds: reviewers.map((r) => r.id),
      deadlineAt: dto.deadlineAt,
    });
  }
}
