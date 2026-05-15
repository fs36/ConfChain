import { Module } from "@nestjs/common";
import { BlockchainController } from "./blockchain.controller";
import { BlockchainService } from "./blockchain.service";
import { ChainRetryService } from "./chain-retry.service";
import { ChainTxService } from "./chain-tx.service";
import { FiscoService } from "./fisco.service";

@Module({
  providers: [FiscoService, BlockchainService, ChainTxService, ChainRetryService],
  controllers: [BlockchainController],
  exports: [BlockchainService, FiscoService, ChainRetryService],
})
export class BlockchainModule {}
