import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { Roles } from "../common/roles.decorator";
import { RolesGuard } from "../common/roles.guard";
import { ConfConfigService, ConferenceConfigDto } from "./conf-config.service";

@Controller("conf-config")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConfConfigController {
  constructor(private readonly confConfigService: ConfConfigService) {}

  /** 获取会议配置（ADMIN） */
  @Get()
  @Roles(Role.ADMIN)
  get() {
    return this.confConfigService.get();
  }

  /** 保存/更新会议配置（ADMIN） */
  @Put()
  @Roles(Role.ADMIN)
  save(@Body() dto: ConferenceConfigDto) {
    return this.confConfigService.save(dto);
  }
}
