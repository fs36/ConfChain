import { Injectable, NotFoundException } from "@nestjs/common";
import { PaperStatus } from "@prisma/client";
import { createHash } from "crypto";
import { BlockchainService } from "../blockchain/blockchain.service";
import { PrismaService } from "../common/prisma.service";
import { AssignReviewDto } from "./dto/assign-review.dto";
import { SubmitReviewDto } from "./dto/submit-review.dto";

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
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
    const threshold = 70;

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
}
