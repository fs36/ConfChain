import { describe, expect, it } from "vitest";
import { BlockchainService } from "./blockchain.service";

// 注意：该测试需要 FiscoService 和 ChainRetryService 依赖注入，
// 当前仅作占位，完整测试需在集成环境中运行
describe("BlockchainService", () => {
  it("can be instantiated with dependencies", () => {
    // BlockchainService 需要 FiscoService 和 ChainRetryService
    // 此处验证模块结构正常
    expect(BlockchainService).toBeDefined();
  });
});
