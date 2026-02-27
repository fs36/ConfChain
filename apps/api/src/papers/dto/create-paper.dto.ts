import { IsArray, IsOptional, IsString, MaxLength } from "class-validator";

export class CreatePaperDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(1000)
  abstract!: string;

  @IsArray()
  keywords!: string[];

  @IsString()
  fileContent!: string;

  @IsOptional()
  @IsString()
  fileName?: string;
}
