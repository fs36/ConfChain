import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { Roles } from "../common/roles.decorator";
import { RolesGuard } from "../common/roles.guard";
import { ChainTxService } from "./chain-tx.service";
import { BlockchainService } from "./blockchain.service";

@Controller("blockchain")
@UseGuards(JwtAuthGuard, RolesGuard)
export class BlockchainController {
  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly chainTxService: ChainTxService,
  ) {}

  /** 节点状态 */
  @Get("nodes/status")
  @Roles(Role.ADMIN)
  getNodeStatus() {
    return this.blockchainService.getNodeStatus();
  }

  /** 从 WeBASE 查询交易详情 */
  @Get("tx/:hash")
  @Roles(Role.ADMIN)
  trace(@Param("hash") hash: string) {
    return this.blockchainService.traceTransaction(hash);
  }

  /** 本地交易列表（分页，带业务类型标签） */
  @Get("txs")
  @Roles(Role.ADMIN)
  listTxs(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @Query("bizType") bizType?: string,
  ) {
    return this.chainTxService.listTxs(page, pageSize, bizType);
  }

  /** 交易统计（版权存证/审稿/裁定数量） */
  @Get("stats")
  @Roles(Role.ADMIN)
  stats() {
    return this.chainTxService.stats();
  }

  /** 按业务 ID（稿件/任务）查询相关链上记录 */
  @Get("biz/:bizId")
  @Roles(Role.ADMIN)
  listByBizId(@Param("bizId") bizId: string) {
    return this.chainTxService.listByBizId(bizId);
  }

  /** 合约信息（地址、版本、部署信息，从环境变量读取） */
  @Get("contracts/info")
  @Roles(Role.ADMIN)
  contractInfo() {
    return {
      contracts: [
        {
          name: "ConfChainCore",
          label: "版权存证 + 审稿核心合约",
          address: process.env.FISCO_CONTRACT_COPYRIGHT ?? null,
          reviewAddress: process.env.FISCO_CONTRACT_REVIEW ?? null,
          groupId: process.env.FISCO_GROUP_ID ?? "group0",
          chainId: process.env.FISCO_CHAIN_ID ?? "-",
          webaseFrontUrl: process.env.WEBASE_FRONT_URL ?? "-",
          functions: [
            { name: "submitCopyright", desc: "版权存证登记 (onlyOwner)" },
            { name: "getCopyright", desc: "查询存证记录" },
            { name: "submitReview", desc: "审稿意见上链 (onlyOwner)" },
            { name: "getReviews", desc: "查询审稿意见" },
            { name: "finalizeDecision", desc: "裁定结果上链 (onlyOwner)" },
            { name: "getDecision", desc: "查询裁定结论" },
          ],
        },
      ],
    };
  }
}
