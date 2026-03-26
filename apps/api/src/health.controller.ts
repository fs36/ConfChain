import { Controller, Get } from "@nestjs/common";
import { BlockchainService } from "./blockchain/blockchain.service";

@Controller("health")
export class HealthController {
  constructor(private readonly blockchainService: BlockchainService) {}

  @Get()
  health() {
    return {
      service: "confchain-api",
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("chain")
  async chain() {
    const status = await this.blockchainService.getNodeStatus();
    return {
      status: "ok",
      chain: status,
    };
  }
}
