import { Injectable, Logger } from "@nestjs/common";
import { ChainRetryService } from "./chain-retry.service";
import {
  CertifyResult,
  FiscoService,
  NodeStatusResult,
  TxTraceResult,
} from "./fisco.service";

/**
 * BlockchainService 是业务层使用的门面。
 * 内部委托 FiscoService 与 WeBASE-Front 通信；
 * 若链不可达则自动将交易入队等待异步重试（不再使用模拟降级）。
 */
@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);

  constructor(
    private readonly fisco: FiscoService,
    private readonly retryService: ChainRetryService,
  ) {}

  async certifyCopyright(input: {
    fileHash: string;
    authorAddress: string;
    timestamp: number;
    metadataHash: string;
    paperId: string;
  }): Promise<CertifyResult> {
    try {
      return await this.fisco.certifyCopyright(input);
    } catch (err: unknown) {
      const msg = (err as Error).message ?? String(err);
      this.logger.warn(`版权存证上链失败，入队重试: ${msg}`);
      const pending = await this.retryService.enqueue({
        bizType: "COPYRIGHT_CERTIFY",
        bizId: input.paperId,
        contractName: "ConfChainCore",
        contractAddress: this.getCopyrightContract(),
        funcName: "submitCopyright",
        funcParam: [
          input.fileHash,
          input.authorAddress && input.authorAddress !== "0x0"
            ? input.authorAddress
            : FiscoService["ZERO_ADDRESS"] ?? "0x0000000000000000000000000000000000000000",
          input.timestamp,
          input.metadataHash.startsWith("0x") ? input.metadataHash : "0x" + input.metadataHash,
        ],
        errorMessage: msg,
      });
      return {
        txHash: "",
        blockHeight: 0,
        simulated: false,
        queued: true,
        pendingTxId: pending.id,
      };
    }
  }

  async submitReview(input: {
    paperId: string;
    reviewerAddress: string;
    score: number;
    recommendation: string;
    commentHash: string;
  }): Promise<CertifyResult> {
    try {
      return await this.fisco.submitReview(input);
    } catch (err: unknown) {
      const msg = (err as Error).message ?? String(err);
      this.logger.warn(`审稿上链失败，入队重试: ${msg}`);
      const pending = await this.retryService.enqueue({
        bizType: "REVIEW_SUBMIT",
        bizId: input.paperId,
        contractName: "ConfChainCore",
        contractAddress: this.getReviewContract(),
        funcName: "submitReview",
        funcParam: [
          input.paperId,
          input.reviewerAddress,
          input.score,
          input.recommendation,
          "0x" + input.commentHash,
        ],
        errorMessage: msg,
      });
      return {
        txHash: "",
        blockHeight: 0,
        simulated: false,
        queued: true,
        pendingTxId: pending.id,
      };
    }
  }

  async finalizeDecision(input: {
    paperId: string;
    decision: string;
  }): Promise<CertifyResult> {
    try {
      return await this.fisco.finalizeDecision(input);
    } catch (err: unknown) {
      const msg = (err as Error).message ?? String(err);
      this.logger.warn(`裁定上链失败，入队重试: ${msg}`);
      const pending = await this.retryService.enqueue({
        bizType: "ADJUDICATE",
        bizId: input.paperId,
        contractName: "ConfChainCore",
        contractAddress: this.getReviewContract(),
        funcName: "finalizeDecision",
        funcParam: [input.paperId, input.decision],
        errorMessage: msg,
      });
      return {
        txHash: "",
        blockHeight: 0,
        simulated: false,
        queued: true,
        pendingTxId: pending.id,
      };
    }
  }

  getNodeStatus(): Promise<NodeStatusResult> {
    return this.fisco.getNodeStatus();
  }

  traceTransaction(txHash: string): Promise<TxTraceResult> {
    return this.fisco.traceTransaction(txHash);
  }

  private getCopyrightContract(): string {
    return (
      process.env.FISCO_CONTRACT_COPYRIGHT ??
      "0x0000000000000000000000000000000000000000"
    );
  }

  private getReviewContract(): string {
    return (
      process.env.FISCO_CONTRACT_REVIEW ??
      "0x0000000000000000000000000000000000000000"
    );
  }
}
