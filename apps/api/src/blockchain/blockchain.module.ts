import { Module } from "@nestjs/common";
import { BlockchainController } from "./blockchain.controller";
import { BlockchainService } from "./blockchain.service";

@Module({
  providers: [BlockchainService],
  controllers: [BlockchainController],
  exports: [BlockchainService],
})
export class BlockchainModule {}
