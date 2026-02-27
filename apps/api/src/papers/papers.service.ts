import { Injectable, NotFoundException } from "@nestjs/common";
import { PaperStatus } from "@prisma/client";
import { createHash } from "crypto";
import { existsSync } from "fs";
import { readFile, unlink } from "fs/promises";
import { join } from "path";
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
      throw new NotFoundException("No file content provided");
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

    const paper = await this.prisma.paper.create({
      data: {
        title: dto.title,
        abstract: dto.abstract,
        keywords: dto.keywords.join(","),
        filePath,
        authorId,
        fileHash,
      },
    });

    // 异步上链（同步等待，失败降级）
    const onchain = await this.blockchainService.certifyCopyright({
      fileHash,
      authorAddress: author.walletAddr ?? "0x0",
      timestamp: Date.now(),
      metadataHash,
    });

    // 更新上链结果
    const updated = await this.prisma.paper.update({
      where: { id: paper.id },
      data: {
        txHash: onchain.txHash,
        blockHeight: onchain.blockHeight,
        certifiedAt: new Date(),
        status: PaperStatus.CERTIFIED,
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
    if (!paper) throw new NotFoundException("Paper not found");

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
      return { found: false, message: "No on-chain record found" };
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

  /** 下载稿件文件（需鉴权） */
  async getFilePath(paperId: string, requesterId: string, isAdmin: boolean) {
    const paper = await this.prisma.paper.findUniqueOrThrow({
      where: { id: paperId },
    });
    if (!isAdmin && paper.authorId !== requesterId) {
      throw new NotFoundException("Paper not found");
    }
    const absPath = paper.filePath.startsWith("/")
      ? paper.filePath
      : join(process.cwd(), paper.filePath);
    if (!existsSync(absPath)) {
      throw new NotFoundException("File not found on disk");
    }
    return { absPath, fileName: paper.filePath.split(/[/\\]/).pop() ?? "paper" };
  }
}
