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
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

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
  /** 发交易用的用户标识：优先为地址 0x...（WEBASE_SIGN_USER_ADDRESS），否则为 WeBASE 用户名 */
  private readonly signUser: string;
  private readonly copyrightContract: string;
  private readonly reviewContract: string;
  private readonly contractAbi: unknown[];

  constructor() {
    const baseURL = process.env.WEBASE_FRONT_URL ?? "http://localhost:5002";
    this.groupId = (process.env.FISCO_GROUP_ID ?? "1").trim();
    // WeBASE /trans/handle 的 user 字段：官方文档要求为「用户地址」0x...；部分版本也支持用户名
    const signAddr = (process.env.WEBASE_SIGN_USER_ADDRESS ?? "").trim();
    const signName = (process.env.WEBASE_SIGN_USER ?? "").trim();
    this.signUser = signAddr || signName;
    this.copyrightContract =
      process.env.FISCO_CONTRACT_COPYRIGHT ??
      "0x0000000000000000000000000000000000000000";
    this.reviewContract =
      process.env.FISCO_CONTRACT_REVIEW ??
      "0x0000000000000000000000000000000000000000";
    this.contractAbi = FiscoService.loadContractAbi();

    this.http = axios.create({
      baseURL,
      timeout: 15000,
    });
  }

  /** 从 contracts/abi 或 apps/api 相对路径加载 ConfChainCore ABI */
  private static loadContractAbi(): unknown[] {
    const candidates = [
      resolve(process.cwd(), "contracts", "abi", "ConfChainCore.json"),
      resolve(process.cwd(), "..", "contracts", "abi", "ConfChainCore.json"),
      resolve(process.cwd(), "..", "..", "contracts", "abi", "ConfChainCore.json"),
    ];
    for (const p of candidates) {
      if (existsSync(p)) {
        try {
          const raw = readFileSync(p, "utf-8");
          const arr = JSON.parse(raw) as unknown[];
          return Array.isArray(arr) ? arr : [arr];
        } catch (e) {
          // continue
        }
      }
    }
    return [];
  }

  /**
   * 调用 WeBASE-Front /trans/handle 发送合约交易
   * 请求体符合官方文档：contractAbi、useCns、cnsName、contractPath 等必填/选填项均带上。
   */
  private async sendTransaction(params: {
    contractName: string;
    contractAddress: string;
    funcName: string;
    funcParam: unknown[];
  }): Promise<{ transactionHash: string; blockNumber: number }> {
    const body: Record<string, unknown> = {
      groupId: this.groupId,
      contractName: params.contractName,
      contractAddress: params.contractAddress,
      funcName: params.funcName,
      funcParam: params.funcParam,
      useAes: false,
      useCns: false,
      cnsName: "",
      contractPath: "/",
      version: "",
    };
    if (this.signUser) {
      body.user = this.signUser;
    } else {
      this.logger.warn(
        "WEBASE_SIGN_USER 或 WEBASE_SIGN_USER_ADDRESS 未设置；WeBASE 可能返回 422 (user cannot be empty)。请设置发交易用的 WeBASE 用户地址（推荐 WEBASE_SIGN_USER_ADDRESS=0x...）。",
      );
    }
    if (this.contractAbi.length > 0) {
      body.contractAbi = this.contractAbi;
    } else {
      this.logger.warn(
        "ConfChainCore ABI 未加载（未找到 contracts/abi/ConfChainCore.json）；WeBASE 可能返回 422 或 supported functions are: []。请确保 ABI 文件存在。",
      );
    }

    const base = process.env.WEBASE_FRONT_URL ?? "";
    const transPath = base.includes("/WeBASE-Front") || base.includes("/webase-front")
      ? "/trans/handle"
      : "/WeBASE-Front/trans/handle";

    const res = await this.http.post<{
      transactionHash: string;
      blockNumber: number;
    }>(transPath, body).catch((err: unknown) => {
      const ax = err as { response?: { status: number; data?: unknown } };
      if (ax?.response?.status === 422 && ax.response?.data) {
        this.logger.warn(
          `WeBASE /trans/handle 422 response: ${JSON.stringify(ax.response.data)}`,
        );
      }
      throw err;
    });

    const blockNumber =
      typeof res.data.blockNumber === "number"
        ? res.data.blockNumber
        : parseInt(String(res.data.blockNumber ?? 0), 10);
    return {
      transactionHash: res.data.transactionHash ?? "",
      blockNumber: Number.isNaN(blockNumber) ? 0 : blockNumber,
    };
  }

  /** 标准零地址（20 字节），避免传 "0x0" 导致 WeBASE 参数校验 422 */
  private static readonly ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  /**
   * 版权存证上链
   * 调用 ConfChainCore.submitCopyright(fileHash, author, timestamp, metadataHash)
   * 注意：合约为 onlyOwner，WeBASE 发交易的账号需为合约 owner。
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

    const authorAddr =
      input.authorAddress && input.authorAddress !== "0x0"
        ? input.authorAddress
        : FiscoService.ZERO_ADDRESS;
    const metadataHashHex =
      input.metadataHash.startsWith("0x") ? input.metadataHash : "0x" + input.metadataHash;

    try {
      const result = await this.sendTransaction({
        contractName: "ConfChainCore",
        contractAddress: this.copyrightContract,
        funcName: "submitCopyright",
        funcParam: [
          input.fileHash,
          authorAddr,
          input.timestamp,
          metadataHashHex,
        ],
      });
      return {
        txHash: result.transactionHash,
        blockHeight: result.blockNumber,
        simulated: false,
      };
    } catch (err: unknown) {
      const ax = err as { response?: { status: number; data?: unknown }; message?: string };
      const msg = ax?.message ?? String(err);
      if (ax?.response?.status === 422) {
        this.logger.warn(
          `WeBASE certifyCopyright 422 Unprocessable: ${JSON.stringify(ax.response?.data ?? {})}`,
        );
      }
      this.logger.error(
        `WeBASE certifyCopyright failed: ${msg}, fallback to simulation`,
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
   * 若 WEBASE_FRONT_URL 已含 /WeBASE-Front，则只拼 /{groupId}/web3；否则拼 /WeBASE-Front/{groupId}/web3
   */
  private getWeb3Prefix(): string[] {
    const base = process.env.WEBASE_FRONT_URL ?? "";
    const g = this.groupId;
    const withContext = (ctx: string) => (ctx ? `${ctx}/${g}/web3` : `/${g}/web3`);
    return [
      withContext(process.env.WEBASE_CONTEXT_PATH ?? ""),
      base.includes("/WeBASE-Front") || base.includes("/webase-front")
        ? `/${g}/web3`
        : `/WeBASE-Front/${g}/web3`,
      `/WeBASE-Front/${g}/web3`,
      `/webase-front/${g}/web3`,
      `/${g}/web3`,
    ];
  }

  /**
   * 查询节点状态
   */
  async getNodeStatus(): Promise<NodeStatusResult> {
    const prefixes = [...new Set(this.getWeb3Prefix())];

    for (const prefix of prefixes) {
      try {
        const [blockRes, nodeRes] = await Promise.all([
          this.http.get<number>(`${prefix}/blockNumber`),
          this.http.get<string[]>(`${prefix}/groupPeers`),
        ]);

        const blockNumber =
          typeof blockRes.data === "number"
            ? blockRes.data
            : typeof blockRes.data === "string"
              ? parseInt(blockRes.data, 10)
              : 0;
        const peerList = Array.isArray(nodeRes.data) ? nodeRes.data : [];

        return {
          connected: true,
          nodeCount: peerList.length,
          blockNumber: Number.isNaN(blockNumber) ? 0 : blockNumber,
          chainId: process.env.FISCO_CHAIN_ID ?? "chain0",
          simulated: false,
        };
      } catch {
        continue;
      }
    }

    this.logger.warn(
      "WeBASE getNodeStatus failed for all path variants, returning simulated status",
    );
    return {
      connected: false,
      nodeCount: 0,
      blockNumber: 0,
      chainId: process.env.FISCO_CHAIN_ID ?? "chain0",
      simulated: true,
    };
  }

  /**
   * 查询交易详情
   * 使用与 getNodeStatus 相同的路径规则，依次尝试
   */
  async traceTransaction(txHash: string): Promise<TxTraceResult> {
    const prefixes = [...new Set(this.getWeb3Prefix())];
    let lastErr: Error | null = null;

    for (const prefix of prefixes) {
      const url = `${prefix}/transaction/${txHash}`;
      try {
        const res = await this.http.get<{
          blockNumber: number;
          from: string;
          to: string;
          hash: string;
        }>(url);

        const data = res.data;
        const blockHeight =
          typeof data.blockNumber === "number"
            ? data.blockNumber
            : typeof data.blockNumber === "string"
              ? parseInt(String(data.blockNumber), 10)
              : 0;

        return {
          txHash: data.hash ?? txHash,
          status: "SUCCESS",
          blockHeight: Number.isNaN(blockHeight) ? 0 : blockHeight,
          timestamp: Date.now(),
          bizType: "ON_CHAIN",
          from: data.from,
          to: data.to,
          simulated: false,
        };
      } catch (err) {
        lastErr = err as Error;
        continue;
      }
    }

    this.logger.warn(
      `WeBASE traceTransaction failed: ${lastErr?.message ?? "all paths failed"}`,
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
