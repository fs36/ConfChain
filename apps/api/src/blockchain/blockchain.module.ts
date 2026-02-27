import { Module } from "@nestjs/common";
import { BlockchainController } from "./blockchain.controller";
import { BlockchainService } from "./blockchain.service";
import { FiscoService } from "./fisco.service";
import { ChainTxService } from "./chain-tx.service";

@Module({
  providers: [FiscoService, BlockchainService, ChainTxService],
  controllers: [BlockchainController],
  exports: [BlockchainService, FiscoService],
})
export class BlockchainModule {}
