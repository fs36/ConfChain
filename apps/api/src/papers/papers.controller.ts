import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { Request } from "express";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { Roles } from "../common/roles.decorator";
import { RolesGuard } from "../common/roles.guard";
import { CreatePaperDto } from "./dto/create-paper.dto";
import { PapersService } from "./papers.service";

type AuthUserRequest = Request & { user: { id: string; role: Role } };

@Controller("papers")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PapersController {
  constructor(private readonly papersService: PapersService) {}

  @Post()
  @Roles(Role.AUTHOR)
  create(@Req() req: AuthUserRequest, @Body() dto: CreatePaperDto) {
    return this.papersService.create(req.user.id, dto);
  }

  @Post(":id/certify")
  @Roles(Role.AUTHOR)
  certify(
    @Req() req: AuthUserRequest,
    @Param("id") id: string,
    @Body("fileContent") fileContent: string,
  ) {
    return this.papersService.certify(id, req.user.id, fileContent);
  }

  @Get("mine")
  @Roles(Role.AUTHOR)
  mine(@Req() req: AuthUserRequest) {
    return this.papersService.listMine(req.user.id);
  }

  @Get("admin/all")
  @Roles(Role.ADMIN)
  listAll() {
    return this.papersService.listAll();
  }

  @Get("verify")
  verify(@Query("fileHash") fileHash: string) {
    return this.papersService.verifyByHash(fileHash);
  }
}
