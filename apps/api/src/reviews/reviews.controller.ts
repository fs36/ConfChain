import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { Request } from "express";
import { JwtAuthGuard } from "../common/jwt-auth.guard";
import { Roles } from "../common/roles.decorator";
import { RolesGuard } from "../common/roles.guard";
import { AssignReviewDto } from "./dto/assign-review.dto";
import { SubmitReviewDto } from "./dto/submit-review.dto";
import { ReviewsService } from "./reviews.service";

type AuthUserRequest = Request & { user: { id: string; role: Role } };

@Controller("reviews")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post("assign")
  @Roles(Role.ADMIN)
  assign(@Body() dto: AssignReviewDto) {
    return this.reviewsService.assign(dto);
  }

  @Post("submit")
  @Roles(Role.REVIEWER)
  submit(@Req() req: AuthUserRequest, @Body() dto: SubmitReviewDto) {
    return this.reviewsService.submit(req.user.id, dto);
  }

  @Post("adjudicate/:paperId")
  @Roles(Role.ADMIN)
  adjudicate(@Param("paperId") paperId: string) {
    return this.reviewsService.adjudicate(paperId);
  }

  @Get("tasks/me")
  @Roles(Role.REVIEWER)
  tasks(@Req() req: AuthUserRequest) {
    return this.reviewsService.myTasks(req.user.id);
  }

  /** 管理员：查看稿件详情（论文信息 + 分数、结果、审稿意见汇总） */
  @Get("admin/paper-detail/:paperId")
  @Roles(Role.ADMIN)
  getPaperDetail(@Param("paperId") paperId: string) {
    return this.reviewsService.getPaperDetailForAdmin(paperId);
  }

  /** 管理员：查看某稿件所有审稿意见汇总（匿名） */
  @Get("results/:paperId")
  @Roles(Role.ADMIN)
  getResults(@Param("paperId") paperId: string) {
    return this.reviewsService.getResults(paperId);
  }

  /** 审稿人：查看已分配稿件的脱敏内容（无作者信息） */
  @Get("paper/:paperId")
  @Roles(Role.REVIEWER)
  getPaperForReviewer(@Req() req: AuthUserRequest, @Param("paperId") paperId: string) {
    return this.reviewsService.getPaperForReviewer(paperId, req.user.id);
  }

  /** 管理员：自动分配审稿人（轻量负载均衡） */
  @Post("auto-assign")
  @Roles(Role.ADMIN)
  autoAssign(
    @Body() dto: { paperId: string; count: number; deadlineAt: string },
  ) {
    return this.reviewsService.autoAssign(dto);
  }
}
