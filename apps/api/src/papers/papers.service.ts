import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PaperStatus } from "@prisma/client";
import { createHash } from "crypto";
import { existsSync } from "fs";
import { readFile, unlink } from "fs/promises";
import { basename, join } from "path";
import { BlockchainService } from "../blockchain/blockchain.service";
import { FiscoService } from "../blockchain/fisco.service";
import { PrismaService } from "../common/prisma.service";
import { CreatePaperDto } from "./dto/create-paper.dto";

@Injectable()
export class PapersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
  ) {}

  /** 创建稿件（不含文件，纯元数据） */
  create(authorId: string, dto: CreatePaperDto) {
    return this.prisma.paper.create({
      data: {
        title: dto.title,
        abstract: dto.abstract,
        keywords: dto.keywords.join(","),
        filePath: dto.fileName ?? "inline-content",
        authorId,
      },
    });
  }

  /** 上传文件、计算哈希并存证（一步完成） */
  async uploadAndCertify(
    authorId: string,
    dto: CreatePaperDto,
    file?: Express.Multer.File,
  ) {
    let fileContent: Buffer | string;
    let filePath = "inline-content";

    if (file) {
      filePath = file.path;
      fileContent = await readFile(file.path);
    } else if (dto.fileContent) {
      fileContent = dto.fileContent;
    } else {
      throw new NotFoundException("未提供文件内容，请选择文件后重试");
    }

    const fileHash = createHash("sha256").update(fileContent).digest("hex");
    const metadataHash = FiscoService.buildMetadataHash(
      dto.title,
      dto.abstract,
      dto.keywords.join(","),
    );

    // 先入库（状态 UPLOADED）
    const author = await this.prisma.user.findUniqueOrThrow({
      where: { id: authorId },
    });

    let paper;
    try {
      paper = await this.prisma.paper.create({
        data: {
          title: dto.title,
          abstract: dto.abstract,
          keywords: dto.keywords.join(","),
          filePath,
          authorId,
          fileHash,
        },
      });
    } catch (err: unknown) {
      const prismaErr = err as { code?: string; meta?: { target?: string | string[] } };
      const isFileHashConflict =
        prismaErr?.code === "P2002" &&
        (prismaErr.meta?.target === "Paper_fileHash_key" ||
          (Array.isArray(prismaErr.meta?.target) && prismaErr.meta.target.includes("Paper_fileHash_key")));
      if (isFileHashConflict) {
        if (file?.path && existsSync(file.path)) {
          await unlink(file.path).catch(() => {});
        }
        throw new ConflictException(
          "该文件已存在存证记录（相同文件哈希），请勿重复提交。请更换文件或到「我的稿件」查看已有记录。",
        );
      }
      throw err;
    }

    // 异步上链（同步等待，失败降级）
    const onchain = await this.blockchainService.certifyCopyright({
      fileHash,
      authorAddress: author.walletAddr ?? "0x0",
      timestamp: Date.now(),
      metadataHash,
    });

    // 更新上链结果（含是否模拟）
    const updated = await this.prisma.paper.update({
      where: { id: paper.id },
      data: {
        txHash: onchain.txHash,
        blockHeight: onchain.blockHeight,
        certifiedAt: new Date(),
        status: PaperStatus.CERTIFIED,
        certifySimulated: onchain.simulated,
      },
    });

    await this.prisma.chainTransaction.create({
      data: {
        bizType: "COPYRIGHT_CERTIFY",
        bizId: paper.id,
        txHash: onchain.txHash,
        blockHeight: onchain.blockHeight,
        payload: { ...onchain, fileHash, metadataHash },
      },
    });

    return {
      ...updated,
      simulated: onchain.simulated,
    };
  }

  /** 对已有稿件重新存证（仅支持 fileContent 方式） */
  async certify(paperId: string, authorId: string, fileContent: string) {
    const paper = await this.prisma.paper.findFirst({
      where: { id: paperId, authorId },
      include: { author: true },
    });
    if (!paper) throw new NotFoundException("稿件不存在");

    const fileHash = createHash("sha256").update(fileContent).digest("hex");
    const metadataHash = FiscoService.buildMetadataHash(
      paper.title,
      paper.abstract,
      paper.keywords,
    );

    const onchain = await this.blockchainService.certifyCopyright({
      fileHash,
      authorAddress: paper.author.walletAddr ?? "0x0",
      timestamp: Date.now(),
      metadataHash,
    });

    const updated = await this.prisma.paper.update({
      where: { id: paperId },
      data: {
        fileHash,
        txHash: onchain.txHash,
        blockHeight: onchain.blockHeight,
        certifiedAt: new Date(),
        status: PaperStatus.CERTIFIED,
        certifySimulated: onchain.simulated,
      },
    });

    await this.prisma.chainTransaction.create({
      data: {
        bizType: "COPYRIGHT_CERTIFY",
        bizId: paperId,
        txHash: onchain.txHash,
        blockHeight: onchain.blockHeight,
        payload: { ...onchain, fileHash },
      },
    });

    return { ...updated, simulated: onchain.simulated };
  }

  listAll() {
    return this.prisma.paper.findMany({
      orderBy: { createdAt: "desc" },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
  }

  listMine(authorId: string) {
    return this.prisma.paper.findMany({
      where: { authorId },
      orderBy: { createdAt: "desc" },
    });
  }

  /** 通过哈希验证版权（公开接口） */
  async verifyByHash(fileHash: string) {
    const paper = await this.prisma.paper.findFirst({
      where: { fileHash },
      include: { author: true },
    });
    if (!paper || !paper.txHash) {
      return { found: false, message: "未找到链上存证记录，该文件可能尚未完成存证" };
    }
    return {
      found: true,
      txHash: paper.txHash,
      blockHeight: paper.blockHeight,
      certifiedAt: paper.certifiedAt,
      authorAddress: paper.author.walletAddr,
      fileHash: paper.fileHash,
      title: paper.title,
      paperStatus: paper.status,
    };
  }

  /** 通过上传文件验证版权（公开接口，计算哈希后查询） */
  async verifyByFile(fileBuffer: Buffer) {
    const fileHash = createHash("sha256").update(fileBuffer).digest("hex");
    return this.verifyByHash(fileHash);
  }

  /**
   * 查询裁定结果（作者本人或管理员）
   * 含审稿意见汇总（分数、录用建议，评语为哈希仅存证不返回原文）
   */
  async getAdjudication(paperId: string, requesterId: string, isAdmin: boolean) {
    const paper = await this.prisma.paper.findUnique({
      where: { id: paperId },
      select: { id: true, authorId: true, status: true, title: true },
    });
    if (!paper) throw new NotFoundException("稿件不存在");
    if (!isAdmin && paper.authorId !== requesterId) throw new NotFoundException("稿件不存在");

    const tx = await this.prisma.chainTransaction.findFirst({
      where: { bizId: paperId, bizType: "ADJUDICATE" },
      orderBy: { createdAt: "desc" },
    });

    const reviewResults = await this.prisma.reviewResult.findMany({
      where: { paperId },
      select: { score: true, recommendation: true, comment: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    const averageScore =
      reviewResults.length > 0
        ? Math.round(
            (reviewResults.reduce((s, r) => s + r.score, 0) / reviewResults.length) * 100,
          ) / 100
        : null;

    return {
      paperId,
      paperTitle: paper.title,
      currentStatus: paper.status,
      adjudication: tx ? tx.payload : null,
      adjudicatedAt: tx ? tx.createdAt : null,
      txHash: tx ? tx.txHash : null,
      blockHeight: tx ? tx.blockHeight : null,
      reviewResults: reviewResults.map((r) => ({
        score: r.score,
        recommendation: r.recommendation,
        comment: r.comment,
        submittedAt: r.createdAt,
      })),
      averageScore,
    };
  }

  /** 下载稿件文件（需鉴权） */
  async getFilePath(paperId: string, requesterId: string, isAdmin: boolean) {
    const paper = await this.prisma.paper.findUniqueOrThrow({
      where: { id: paperId },
    });
    if (!isAdmin && paper.authorId !== requesterId) {
      throw new NotFoundException("Paper not found");
    }
    const isAbsolute =
      paper.filePath.startsWith("/") ||
      /^[a-zA-Z]:[/\\]/.test(paper.filePath);
    let absPath = isAbsolute
      ? paper.filePath
      : join(process.cwd(), paper.filePath);
    if (!existsSync(absPath)) {
      const candidates = [
        join(process.cwd(), "uploads", basename(paper.filePath)),
        join(process.cwd(), "..", "uploads", basename(paper.filePath)),
        join(process.cwd(), "..", "..", "uploads", basename(paper.filePath)),
      ];
      const found = candidates.find((p) => existsSync(p));
      if (found) absPath = found;
      else throw new NotFoundException("文件在服务器磁盘上不存在，请联系管理员");
    }
    return { absPath, fileName: basename(paper.filePath) || "paper" };
  }

  /**
   * 审稿人下载已分配稿件的文件（仅当存在该稿件的审稿任务时可访问）
   */
  async getFilePathForReviewer(paperId: string, reviewerId: string) {
    const task = await this.prisma.reviewTask.findFirst({
      where: { paperId, reviewerId },
    });
    if (!task) throw new ForbiddenException("您未被分配到该稿件");

    return this.getFilePath(paperId, "", true);
  }

  /**
   * 作者提交修订稿（仅当稿件状态为 REVISION 时）：上传新文件并重新存证
   */
  async submitRevision(
    paperId: string,
    authorId: string,
    file: Express.Multer.File,
  ) {
    const paper = await this.prisma.paper.findUnique({
      where: { id: paperId },
      include: { author: true },
    });
    if (!paper) throw new NotFoundException("稿件不存在");
    if (paper.authorId !== authorId) throw new ForbiddenException("仅作者可提交修订稿");
    if (paper.status !== PaperStatus.REVISION) {
      throw new ForbiddenException("仅「需修改」状态的稿件可提交修订稿");
    }

    const fileContent = await readFile(file.path);
    const fileHash = createHash("sha256").update(fileContent).digest("hex");
    const metadataHash = FiscoService.buildMetadataHash(
      paper.title,
      paper.abstract,
      paper.keywords,
    );

    const onchain = await this.blockchainService.certifyCopyright({
      fileHash,
      authorAddress: paper.author.walletAddr ?? "0x0",
      timestamp: Date.now(),
      metadataHash,
    });

    const updated = await this.prisma.paper.update({
      where: { id: paperId },
      data: {
        filePath: file.path,
        fileHash,
        txHash: onchain.txHash,
        blockHeight: onchain.blockHeight,
        certifiedAt: new Date(),
        status: PaperStatus.CERTIFIED,
        certifySimulated: onchain.simulated,
      },
    });

    await this.prisma.chainTransaction.create({
      data: {
        bizType: "COPYRIGHT_CERTIFY",
        bizId: paperId,
        txHash: onchain.txHash,
        blockHeight: onchain.blockHeight,
        payload: { ...onchain, fileHash, metadataHash, revision: true },
      },
    });

    return { ...updated, simulated: onchain.simulated };
  }
}
