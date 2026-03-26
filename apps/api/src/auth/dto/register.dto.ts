import { IsEmail, IsString, Length, Matches } from "class-validator";

export class RegisterDto {
  @IsString()
  @Length(2, 20)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @Length(8, 20)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: "Password must include upper/lowercase letters and numbers",
  })
  password!: string;
}
