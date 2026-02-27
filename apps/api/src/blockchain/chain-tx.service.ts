import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";

const BIZ_TYPE_LABEL: Record<string, string> = {
  COPYRIGHT_CERTIFY: "版权存证",
  REVIEW_SUBMIT: "审稿上链",
  ADJUDICATE: "裁定结果",
};

@Injectable()
export class ChainTxService {
  constructor(private readonly prisma: PrismaService) {}

  /** 交易列表（分页），带业务类型中文映射 */
  async listTxs(page: number, pageSize: number, bizType?: string) {
    const where = bizType ? { bizType } : {};
    const [total, items] = await this.prisma.$transaction([
      this.prisma.chainTransaction.count({ where }),
      this.prisma.chainTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      total,
      page,
      pageSize,
      items: items.map((tx) => ({
        ...tx,
        bizTypeLabel: BIZ_TYPE_LABEL[tx.bizType] ?? tx.bizType,
      })),
    };
  }

  /** 统计各业务类型交易数量 */
  async stats() {
    const [total, certifyCount, reviewCount, adjudicateCount] =
      await this.prisma.$transaction([
        this.prisma.chainTransaction.count(),
        this.prisma.chainTransaction.count({ where: { bizType: "COPYRIGHT_CERTIFY" } }),
        this.prisma.chainTransaction.count({ where: { bizType: "REVIEW_SUBMIT" } }),
        this.prisma.chainTransaction.count({ where: { bizType: "ADJUDICATE" } }),
      ]);
    return { total, certifyCount, reviewCount, adjudicateCount };
  }

  /** 通过业务 ID 查询该稿件/任务相关的所有链上记录 */
  async listByBizId(bizId: string) {
    const items = await this.prisma.chainTransaction.findMany({
      where: { bizId },
      orderBy: { createdAt: "desc" },
    });
    return items.map((tx) => ({
      ...tx,
      bizTypeLabel: BIZ_TYPE_LABEL[tx.bizType] ?? tx.bizType,
    }));
  }
}
