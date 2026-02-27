import { Injectable, NotFoundException } from "@nestjs/common";
import { PaperStatus } from "@prisma/client";
import { createHash } from "crypto";
import { BlockchainService } from "../blockchain/blockchain.service";
import { PrismaService } from "../common/prisma.service";
import { CreatePaperDto } from "./dto/create-paper.dto";

@Injectable()
export class PapersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
  ) {}

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

  async certify(paperId: string, authorId: string, fileContent: string) {
    const paper = await this.prisma.paper.findFirst({
      where: { id: paperId, authorId },
      include: { author: true },
    });
    if (!paper) throw new NotFoundException("Paper not found");

    const fileHash = createHash("sha256").update(fileContent).digest("hex");
    const onchain = this.blockchainService.certifyCopyright({
      fileHash,
      authorAddress: paper.author.walletAddr ?? "0x0",
      timestamp: Date.now(),
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
        payload: onchain,
      },
    });
    return updated;
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

  async verifyByHash(fileHash: string) {
    const paper = await this.prisma.paper.findFirst({
      where: { fileHash },
      include: { author: true },
    });
    if (!paper) {
      return { found: false, message: "No on-chain record found" };
    }
    return {
      found: true,
      txHash: paper.txHash,
      blockHeight: paper.blockHeight,
      timestamp: paper.certifiedAt,
      authorAddress: paper.author.walletAddr,
      fileHash: paper.fileHash,
    };
  }
}
