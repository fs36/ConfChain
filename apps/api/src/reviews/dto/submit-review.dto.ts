import { IsInt, IsString, Max, Min } from "class-validator";

export class SubmitReviewDto {
  @IsString()
  taskId!: string;

  @IsInt()
  @Min(0)
  @Max(100)
  score!: number;

  @IsString()
  recommendation!: string;

  @IsString()
  comment!: string;
}
