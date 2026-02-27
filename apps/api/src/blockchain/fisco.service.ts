/**
 * WeBASE-Front HTTP 适配层
 *
 * 对接 Ubuntu 上的 WeBASE-Front（默认端口 5002）。
 * 所有上链操作经由 WeBASE-Front /trans/handle 接口完成。
 * 节点状态通过 /web3/blockNumber 和 /web3/connectedCount 获取。
 *
 * 若 WeBASE-Front 不可达，自动降级返回模拟数据并打印警告，
 * 保证开发/演示环境在链不可用时仍可运行。
 */
import { Injectable, Logger } from "@nestjs/common";
import axios, { AxiosInstance } from "axios";
import { createHash, randomBytes } from "crypto";

export interface CertifyResult {
  txHash: string;
  blockHeight: number;
  simulated: boolean;
}

export interface NodeStatusResult {
  connected: boolean;
  nodeCount: number;
  blockNumber: number;
  chainId: string;
  pbftView?: number;
  simulated: boolean;
}

export interface TxTraceResult {
  txHash: string;
  status: string;
  blockHeight: number;
  timestamp: number;
  bizType: string;
  from?: string;
  to?: string;
  simulated: boolean;
}

@Injectable()
export class FiscoService {
  private readonly logger = new Logger(FiscoService.name);
  private readonly http: AxiosInstance;
  private readonly groupId: string;
  private readonly copyrightContract: string;
  private readonly reviewContract: string;

  constructor() {
    const baseURL = process.env.WEBASE_FRONT_URL ?? "http://localhost:5002";
    this.groupId = process.env.FISCO_GROUP_ID ?? "1";
    this.copyrightContract =
      process.env.FISCO_CONTRACT_COPYRIGHT ??
      "0x0000000000000000000000000000000000000000";
    this.reviewContract =
      process.env.FISCO_CONTRACT_REVIEW ??
      "0x0000000000000000000000000000000000000000";

    this.http = axios.create({
      baseURL,
      timeout: 15000,
    });
  }

  /**
   * 调用 WeBASE-Front /trans/handle 发送合约交易
   */
  private async sendTransaction(params: {
    contractName: string;
    contractAddress: string;
    funcName: string;
    funcParam: unknown[];
  }): Promise<{ transactionHash: string; blockNumber: number }> {
    const body = {
      groupId: this.groupId,
      contractName: params.contractName,
      contractAddress: params.contractAddress,
      funcName: params.funcName,
      funcParam: params.funcParam,
      useAes: false,
    };

    const res = await this.http.post<{
      transactionHash: string;
      blockNumber: number;
    }>("/WeBASE-Front/trans/handle", body);

    return {
      transactionHash: res.data.transactionHash,
      blockNumber: res.data.blockNumber ?? 0,
    };
  }

  /**
   * 版权存证上链
   * 调用 ConfChainCore.submitCopyright(fileHash, author, timestamp, metadataHash)
   */
  async certifyCopyright(input: {
    fileHash: string;
    authorAddress: string;
    timestamp: number;
    metadataHash: string;
  }): Promise<CertifyResult> {
    if (this.isContractZeroAddress(this.copyrightContract)) {
      this.logger.warn(
        "Copyright contract address not configured, using simulated result",
      );
      return this.simulateCertify();
    }

    try {
      const result = await this.sendTransaction({
        contractName: "ConfChainCore",
        contractAddress: this.copyrightContract,
        funcName: "submitCopyright",
        funcParam: [
          input.fileHash,
          input.authorAddress,
          input.timestamp,
          "0x" + input.metadataHash,
        ],
      });
      return {
        txHash: result.transactionHash,
        blockHeight: result.blockNumber,
        simulated: false,
      };
    } catch (err) {
      this.logger.error(
        `WeBASE certifyCopyright failed: ${(err as Error).message}, fallback to simulation`,
      );
      return this.simulateCertify();
    }
  }

  /**
   * 审稿结果上链
   * 调用 ConfChainCore.submitReview(paperId, reviewer, score, recommendation, commentHash)
   */
  async submitReview(input: {
    paperId: string;
    reviewerAddress: string;
    score: number;
    recommendation: string;
    commentHash: string;
  }): Promise<CertifyResult> {
    if (this.isContractZeroAddress(this.reviewContract)) {
      this.logger.warn(
        "Review contract address not configured, using simulated result",
      );
      return this.simulateCertify();
    }

    try {
      const result = await this.sendTransaction({
        contractName: "ConfChainCore",
        contractAddress: this.reviewContract,
        funcName: "submitReview",
        funcParam: [
          input.paperId,
          input.reviewerAddress,
          input.score,
          input.recommendation,
          "0x" + input.commentHash,
        ],
      });
      return {
        txHash: result.transactionHash,
        blockHeight: result.blockNumber,
        simulated: false,
      };
    } catch (err) {
      this.logger.error(
        `WeBASE submitReview failed: ${(err as Error).message}, fallback to simulation`,
      );
      return this.simulateCertify();
    }
  }

  /**
   * 裁定结果上链
   */
  async finalizeDecision(input: {
    paperId: string;
    decision: string;
  }): Promise<CertifyResult> {
    if (this.isContractZeroAddress(this.reviewContract)) {
      return this.simulateCertify();
    }

    try {
      const result = await this.sendTransaction({
        contractName: "ConfChainCore",
        contractAddress: this.reviewContract,
        funcName: "finalizeDecision",
        funcParam: [input.paperId, input.decision],
      });
      return {
        txHash: result.transactionHash,
        blockHeight: result.blockNumber,
        simulated: false,
      };
    } catch (err) {
      this.logger.error(
        `WeBASE finalizeDecision failed: ${(err as Error).message}, fallback to simulation`,
      );
      return this.simulateCertify();
    }
  }

  /**
   * 查询节点状态
   */
  async getNodeStatus(): Promise<NodeStatusResult> {
    try {
      const [blockRes, nodeRes] = await Promise.all([
        this.http.get<number>(`/WeBASE-Front/web3/blockNumber`, {
          params: { groupId: this.groupId },
        }),
        this.http.get<string[]>(`/WeBASE-Front/web3/nodeIdList`, {
          params: { groupId: this.groupId },
        }),
      ]);

      return {
        connected: true,
        nodeCount: Array.isArray(nodeRes.data) ? nodeRes.data.length : 0,
        blockNumber: typeof blockRes.data === "number" ? blockRes.data : 0,
        chainId: process.env.FISCO_CHAIN_ID ?? "chain0",
        simulated: false,
      };
    } catch (err) {
      this.logger.warn(
        `WeBASE getNodeStatus failed: ${(err as Error).message}, returning simulated status`,
      );
      return {
        connected: false,
        nodeCount: 0,
        blockNumber: 0,
        chainId: process.env.FISCO_CHAIN_ID ?? "chain0",
        simulated: true,
      };
    }
  }

  /**
   * 查询交易详情
   */
  async traceTransaction(txHash: string): Promise<TxTraceResult> {
    try {
      const res = await this.http.get<{
        blockNumber: number;
        from: string;
        to: string;
        status: string;
      }>(`/WeBASE-Front/web3/transaction/${txHash}`, {
        params: { groupId: this.groupId },
      });

      return {
        txHash,
        status: res.data.status ?? "SUCCESS",
        blockHeight: res.data.blockNumber ?? 0,
        timestamp: Date.now(),
        bizType: "ON_CHAIN",
        from: res.data.from,
        to: res.data.to,
        simulated: false,
      };
    } catch (err) {
      this.logger.warn(
        `WeBASE traceTransaction failed: ${(err as Error).message}`,
      );
      return {
        txHash,
        status: "UNKNOWN",
        blockHeight: 0,
        timestamp: Date.now(),
        bizType: "UNKNOWN",
        simulated: true,
      };
    }
  }

  private simulateCertify(): CertifyResult {
    return {
      txHash: `0x${randomBytes(32).toString("hex")}`,
      blockHeight: Math.floor(Date.now() / 1000),
      simulated: true,
    };
  }

  private isContractZeroAddress(addr: string): boolean {
    return (
      !addr ||
      addr === "0x0000000000000000000000000000000000000000" ||
      addr === "0x0"
    );
  }

  /** 计算元数据哈希（标题+摘要+关键词的 SHA-256） */
  static buildMetadataHash(title: string, abstract: string, keywords: string): string {
    return createHash("sha256")
      .update(`${title}|${abstract}|${keywords}`)
      .digest("hex");
  }
}
