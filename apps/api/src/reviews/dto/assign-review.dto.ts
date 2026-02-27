import { IsArray, IsDateString, IsString } from "class-validator";

export class AssignReviewDto {
  @IsString()
  paperId!: string;

  @IsArray()
  reviewerIds!: string[];

  @IsDateString()
  deadlineAt!: string;
}
