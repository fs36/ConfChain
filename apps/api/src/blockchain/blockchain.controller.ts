import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { Roles } from "../common/roles.decorator";
import { RolesGuard } from "../common/roles.guard";
import { BlockchainService } from "./blockchain.service";

@Controller("blockchain")
@UseGuards(JwtAuthGuard, RolesGuard)
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  @Get("nodes/status")
  @Roles(Role.ADMIN)
  async getNodeStatus() {
    return this.blockchainService.getNodeStatus();
  }

  @Get("tx/:hash")
  @Roles(Role.ADMIN)
  async trace(@Param("hash") hash: string) {
    return this.blockchainService.traceTransaction(hash);
  }
}
