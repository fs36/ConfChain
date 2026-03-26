import { IsEmail, IsHexadecimal, IsString, Length } from "class-validator";

export class RegisterDto {
  @IsString()
  @Length(2, 20)
  name!: string;

  @IsEmail()
  email!: string;

  /**
   * 前端在传输前已对原始密码做 SHA-256 哈希，
   * 此处接收的是 64 位十六进制字符串（不在网络上传输明文密码）。
   * 原始密码的强度校验（大小写+数字）由前端 RegisterView 执行。
   */
  @IsHexadecimal()
  @Length(64, 64)
  password!: string;
}
