import { describe, expect, it } from "vitest";
import { BlockchainService } from "./blockchain.service";

describe("BlockchainService", () => {
  it("returns node status with rpc", () => {
    const service = new BlockchainService();
    const status = service.getNodeStatus();
    expect(status.rpc).toBeTypeOf("string");
    expect(status.chainId).toBeTruthy();
  });
});
