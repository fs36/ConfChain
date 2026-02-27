import { Module } from "@nestjs/common";
import { BlockchainModule } from "../blockchain/blockchain.module";
import { PapersController } from "./papers.controller";
import { PapersService } from "./papers.service";

@Module({
  imports: [BlockchainModule],
  controllers: [PapersController],
  providers: [PapersService],
  exports: [PapersService],
})
export class PapersModule {}
