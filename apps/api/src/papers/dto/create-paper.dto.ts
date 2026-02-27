import { IsArray, IsOptional, IsString, MaxLength } from "class-validator";

export class CreatePaperDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(2000)
  abstract!: string;

  @IsArray()
  keywords!: string[];

  /** 仅在无文件上传时（纯 JSON 投稿）使用，用于哈希计算 */
  @IsOptional()
  @IsString()
  fileContent?: string;

  @IsOptional()
  @IsString()
  fileName?: string;
}
