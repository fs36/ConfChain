import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Role } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { PrismaService } from "../common/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException("该邮箱已被注册，请直接登录或使用其他邮箱");

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const walletAddr = `0x${randomBytes(20).toString("hex")}`;
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        role: Role.AUTHOR,
        walletAddr,
        publicKey: randomBytes(32).toString("hex"),
        privateKey: randomBytes(64).toString("hex"),
      },
    });
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      walletAddr: user.walletAddr,
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { id: user.id, email: user.email, name: user.name, role: user.role, walletAddr: user.walletAddr };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException("账号或密码不正确");

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("账号或密码不正确");

    const payload: Record<string, string> = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return {
      accessToken: await this.jwtService.signAsync(payload, {
        expiresIn: process.env.JWT_ACCESS_EXPIRES ?? "15m",
      } as never),
      refreshToken: await this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET ?? "change_me_refresh",
        expiresIn: process.env.JWT_REFRESH_EXPIRES ?? "7d",
      } as never),
      user: { id: user.id, email: user.email, role: user.role },
    };
  }
}
