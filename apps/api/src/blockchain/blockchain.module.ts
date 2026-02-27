import { Module } from "@nestjs/common";
import { BlockchainController } from "./blockchain.controller";
import { BlockchainService } from "./blockchain.service";
import { FiscoService } from "./fisco.service";

@Module({
  providers: [FiscoService, BlockchainService],
  controllers: [BlockchainController],
  exports: [BlockchainService, FiscoService],
})
export class BlockchainModule {}
