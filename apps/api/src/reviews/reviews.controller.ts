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
}
