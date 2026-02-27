import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "crypto";

@Injectable()
export class BlockchainService {
  certifyCopyright(input: {
    fileHash: string;
    authorAddress: string;
    timestamp: number;
  }) {
    return {
      txHash: `0x${randomBytes(32).toString("hex")}`,
      blockHeight: Math.floor(Date.now() / 1000),
      chainProof: createHash("sha256")
        .update(`${input.fileHash}:${input.authorAddress}:${input.timestamp}`)
        .digest("hex"),
    };
  }

  submitReview(input: {
    paperId: string;
    reviewerAddress: string;
    score: number;
    recommendation: string;
  }) {
    return {
      txHash: `0x${randomBytes(32).toString("hex")}`,
      proof: createHash("sha256")
        .update(
          `${input.paperId}:${input.reviewerAddress}:${input.score}:${input.recommendation}`,
        )
        .digest("hex"),
    };
  }

  getNodeStatus() {
    return {
      chainId: process.env.FISCO_CHAIN_ID ?? "chain0",
      groupId: Number(process.env.FISCO_GROUP_ID ?? "1"),
      rpc: process.env.FISCO_RPC_URL ?? "http://localhost:20200",
      pbft: "healthy",
      tps: 95,
      blockHeight: Math.floor(Date.now() / 1000),
    };
  }

  traceTransaction(txHash: string) {
    return {
      txHash,
      status: "SUCCESS",
      blockHeight: Math.floor(Date.now() / 1000),
      timestamp: Date.now(),
      bizType: "MIXED",
    };
  }
}
