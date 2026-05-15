import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PaperStatus } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { FiscoService } from "./fisco.service";

export interface EnqueueParams {
  bizType: string;
  bizId: string;
  contractName: string;
  contractAddress: string;
  funcName: string;
  funcParam: unknown[];
  maxRetries?: number;
  /** 首次触发入队时的原始错误消息 */
  errorMessage?: string;
}

/** 将常见的英文链上错误翻译为中文提示 */
function translateChainError(err: string): string {
  const lower = err.toLowerCase();
  if (lower.includes("timeout")) return `链节点请求超时（${err}）`;
  if (lower.includes("econnrefused") || lower.includes("connection refused")) return `链节点连接被拒绝（${err}）`;
  if (lower.includes("enetunreach") || lower.includes("network") || lower.includes("ehostunreach")) return `链节点网络不可达（${err}）`;
  if (lower.includes("404")) return `链服务接口不存在（${err}）`;
  if (lower.includes("500")) return `链服务内部错误（${err}）`;
  if (lower.includes("502") || lower.includes("503")) return `链服务暂时不可用（${err}）`;
  if (lower.includes("certificate") || lower.includes("ssl")) return `链节点证书/SSL 错误（${err}）`;
  return `链上请求失败：${err}`;
}

@Injectable()
export class ChainRetryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChainRetryService.name);
  private retryTimer: ReturnType<typeof setInterval> | null = null;
  /** 自动重试间隔（毫秒），默认 30 秒 */
  private readonly AUTO_RETRY_INTERVAL_MS = 30_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fisco: FiscoService,
  ) {}

  onModuleInit() {
    this.logger.log("启动链上交易自动重试调度器（间隔 30s）");
    this.retryTimer = setInterval(() => {
      this.retryPending().catch((err) =>
        this.logger.error(`自动重试异常: ${(err as Error).message}`),
      );
    }, this.AUTO_RETRY_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
  }

  /** 将失败交易加入待上链队列 */
  async enqueue(params: EnqueueParams) {
    const translatedError = params.errorMessage
      ? translateChainError(params.errorMessage)
      : undefined;
    const pending = await this.prisma.pendingChainTx.create({
      data: {
        bizType: params.bizType,
        bizId: params.bizId,
        contractName: params.contractName,
        contractAddress: params.contractAddress,
        funcName: params.funcName,
        funcParam: params.funcParam as any,
        maxRetries: params.maxRetries ?? 5,
        retryCount: 0,
        nextRetryAt: new Date(Date.now() + 30_000), // 30 秒后首次重试
        status: "PENDING",
        lastError: translatedError,
      },
    });
    this.logger.log(
      `交易已入队 [${params.bizType}] bizId=${params.bizId} pendingId=${pending.id}`,
    );
    return pending;
  }

  /** 重试所有到期（nextRetryAt <= now）且状态为 PENDING 的待上链交易 */
  async retryPending(): Promise<{ succeeded: number; failed: number }> {
    const dueItems = await this.prisma.pendingChainTx.findMany({
      where: {
        status: "PENDING",
        nextRetryAt: { lte: new Date() },
      },
      orderBy: { createdAt: "asc" },
      take: 20, // 每批最多处理 20 条
    });

    if (dueItems.length === 0) return { succeeded: 0, failed: 0 };

    this.logger.log(`开始重试 ${dueItems.length} 条待上链交易`);
    let succeeded = 0;
    let failed = 0;

    for (const item of dueItems) {
      try {
        await this.retryOne(item.id);
        succeeded++;
      } catch {
        failed++;
      }
    }

    this.logger.log(`重试完成: 成功 ${succeeded}, 仍失败 ${failed}`);
    return { succeeded, failed };
  }

  /** 重试单条待上链交易 */
  async retryOne(pendingId: string) {
    const pending = await this.prisma.pendingChainTx.findUnique({
      where: { id: pendingId },
    });
    if (!pending) throw new Error(`PendingChainTx ${pendingId} 不存在`);
    if (pending.status === "CONFIRMED") return pending;
    if (pending.status === "FAILED") {
      this.logger.warn(`交易 ${pendingId} 已标记 FAILED，跳过重试`);
      return pending;
    }

    // 标记为 RETRYING 防止并发重复
    await this.prisma.pendingChainTx.update({
      where: { id: pendingId },
      data: { status: "RETRYING" },
    });

    try {
      const result = await this.fisco.sendTransaction({
        contractName: pending.contractName as string,
        contractAddress: pending.contractAddress as string,
        funcName: pending.funcName as string,
        funcParam: pending.funcParam as unknown[],
      });

      // 上链成功 → 回写业务表 + 更新队列状态
      await this.onRetrySuccess(pending, result.transactionHash, result.blockNumber);

      return this.prisma.pendingChainTx.update({
        where: { id: pendingId },
        data: {
          status: "CONFIRMED",
          confirmedTxHash: result.transactionHash,
          confirmedBlockHeight: result.blockNumber,
          lastError: null,
        },
      });
    } catch (err: unknown) {
      const errMsg = translateChainError((err as Error).message ?? String(err));
      const newRetryCount = pending.retryCount + 1;
      const isExceeded = newRetryCount >= pending.maxRetries;

      if (isExceeded) {
        // 超过最大重试次数 → 标记 FAILED
        this.logger.error(
          `交易 ${pendingId} 已达最大重试次数 (${pending.maxRetries})，标记 FAILED: ${errMsg}`,
        );
        return this.prisma.pendingChainTx.update({
          where: { id: pendingId },
          data: {
            status: "FAILED",
            retryCount: newRetryCount,
            lastError: errMsg,
          },
        });
      }

      // 指数退避: 30s * 2^retryCount，上限 5 分钟
      const backoffMs = Math.min(30_000 * Math.pow(2, newRetryCount), 300_000);
      this.logger.warn(
        `交易 ${pendingId} 重试 ${newRetryCount}/${pending.maxRetries} 失败，${Math.round(backoffMs / 1000)}s 后重试: ${errMsg}`,
      );

      return this.prisma.pendingChainTx.update({
        where: { id: pendingId },
        data: {
          status: "PENDING",
          retryCount: newRetryCount,
          nextRetryAt: new Date(Date.now() + backoffMs),
          lastError: errMsg,
        },
      });
    }
  }

  /** 重试成功后回写业务表 */
  private async onRetrySuccess(
    pending: { bizType: string; bizId: string; funcParam: unknown },
    txHash: string,
    blockHeight: number,
  ) {
    switch (pending.bizType) {
      case "COPYRIGHT_CERTIFY": {
        // 更新 Paper 为 CERTIFIED
        const funcParam = pending.funcParam as Record<string, unknown>[];
        await this.prisma.paper.update({
          where: { id: pending.bizId },
          data: {
            txHash,
            blockHeight,
            certifiedAt: new Date(),
            status: PaperStatus.CERTIFIED,
            certifySimulated: false,
          },
        });
        // 创建链上交易记录
        await this.prisma.chainTransaction.create({
          data: {
            bizType: "COPYRIGHT_CERTIFY",
            bizId: pending.bizId,
            txHash,
            blockHeight,
            payload: { retried: true } as any,
          },
        });
        this.logger.log(`版权存证重试成功 paperId=${pending.bizId} txHash=${txHash}`);
        break;
      }

      case "REVIEW_SUBMIT": {
        // 更新 ReviewResult 的 txHash（取最新一条）
        const latestResult = await this.prisma.reviewResult.findFirst({
          where: { paperId: pending.bizId },
          orderBy: { createdAt: "desc" },
        });
        if (latestResult) {
          await this.prisma.reviewResult.update({
            where: { id: latestResult.id },
            data: { txHash },
          });
        }
        // 更新 ReviewTask
        await this.prisma.reviewTask.updateMany({
          where: { paperId: pending.bizId },
          data: { assignTxHash: txHash },
        });
        // 创建链上交易记录
        await this.prisma.chainTransaction.create({
          data: {
            bizType: "REVIEW_SUBMIT",
            bizId: pending.bizId,
            txHash,
            blockHeight,
            payload: { retried: true },
          },
        });
        this.logger.log(`审稿上链重试成功 paperId=${pending.bizId} txHash=${txHash}`);
        break;
      }

      case "ADJUDICATE": {
        // 创建链上交易记录（Paper 状态已在裁定当时更新）
        await this.prisma.chainTransaction.create({
          data: {
            bizType: "ADJUDICATE",
            bizId: pending.bizId,
            txHash,
            blockHeight,
            payload: { retried: true },
          },
        });
        this.logger.log(`裁定上链重试成功 paperId=${pending.bizId} txHash=${txHash}`);
        break;
      }

      default:
        this.logger.warn(`未知 bizType: ${pending.bizType}，仅记录链上交易`);
        await this.prisma.chainTransaction.create({
          data: {
            bizType: pending.bizType,
            bizId: pending.bizId,
            txHash,
            blockHeight,
            payload: { retried: true },
          },
        });
    }
  }

  /** 查询待上链队列（分页） */
  async listPending(page: number, pageSize: number, status?: string) {
    const where: { status?: string } = {};
    if (status) where.status = status;
    const [total, items] = await this.prisma.$transaction([
      this.prisma.pendingChainTx.count({ where }),
      this.prisma.pendingChainTx.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, items };
  }

  /** 待上链队列统计 */
  async pendingStats() {
    const [pending, failed, confirmed] = await this.prisma.$transaction([
      this.prisma.pendingChainTx.count({ where: { status: "PENDING" } }),
      this.prisma.pendingChainTx.count({ where: { status: "FAILED" } }),
      this.prisma.pendingChainTx.count({ where: { status: "CONFIRMED" } }),
    ]);
    return { pending, failed, confirmed, total: pending + failed + confirmed };
  }
}
