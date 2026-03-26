import { IsEmail, IsHexadecimal, Length } from "class-validator";

export class LoginDto {
  @IsEmail()
  email!: string;

  /**
   * 前端在传输前已对原始密码做 SHA-256 哈希，
   * 此处接收的是 64 位十六进制字符串（不在网络上传输明文密码）。
   */
  @IsHexadecimal()
  @Length(64, 64)
  password!: string;
}
