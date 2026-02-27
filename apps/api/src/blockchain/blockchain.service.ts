import { Injectable } from "@nestjs/common";
import {
  CertifyResult,
  FiscoService,
  NodeStatusResult,
  TxTraceResult,
} from "./fisco.service";

/**
 * BlockchainService 是业务层使用的门面。
 * 内部委托 FiscoService 与 WeBASE-Front 通信；
 * 若链不可达会自动降级（FiscoService 内处理），业务层无需关心。
 */
@Injectable()
export class BlockchainService {
  constructor(private readonly fisco: FiscoService) {}

  certifyCopyright(input: {
    fileHash: string;
    authorAddress: string;
    timestamp: number;
    metadataHash: string;
  }): Promise<CertifyResult> {
    return this.fisco.certifyCopyright(input);
  }

  submitReview(input: {
    paperId: string;
    reviewerAddress: string;
    score: number;
    recommendation: string;
    commentHash: string;
  }): Promise<CertifyResult> {
    return this.fisco.submitReview(input);
  }

  finalizeDecision(input: {
    paperId: string;
    decision: string;
  }): Promise<CertifyResult> {
    return this.fisco.finalizeDecision(input);
  }

  getNodeStatus(): Promise<NodeStatusResult> {
    return this.fisco.getNodeStatus();
  }

  traceTransaction(txHash: string): Promise<TxTraceResult> {
    return this.fisco.traceTransaction(txHash);
  }
}
