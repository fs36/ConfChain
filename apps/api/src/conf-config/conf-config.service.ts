import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";

export interface ConferenceConfigDto {
  /** 全局裁定阈值 */
  acceptThreshold: number;
}

@Injectable()
export class ConfConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /** 获取当前会议配置（取最新一条，不存在则返回默认值） */
  async get() {
    const config = await this.prisma.conferenceConfig.findFirst({
      orderBy: { createdAt: "desc" },
    });
    if (config) return config;
    return {
      id: null,
      conferenceName: "ConfChain 学术会议",
      submitStartAt: null,
      submitEndAt: null,
      reviewDays: 14,
      acceptThreshold: 70,
      weightInnovation: 40,
      weightScience: 40,
      weightWriting: 20,
      createdAt: null,
      updatedAt: null,
    };
  }

  /** 管理员保存/更新会议配置（upsert 最新一条） */
  async save(dto: ConferenceConfigDto) {
    const existing = await this.prisma.conferenceConfig.findFirst({
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return this.prisma.conferenceConfig.update({
        where: { id: existing.id },
        data: {
          acceptThreshold: dto.acceptThreshold,
        },
      });
    }
    return this.prisma.conferenceConfig.create({
      data: {
        conferenceName: "ConfChain 学术会议",
        submitStartAt: new Date(),
        submitEndAt: new Date(),
        reviewDays: 14,
        acceptThreshold: dto.acceptThreshold,
        weightInnovation: 40,
        weightScience: 40,
        weightWriting: 20,
      },
    });
  }

  /** 获取当前裁定阈值（供 ReviewsService 动态读取） */
  async getThreshold(): Promise<number> {
    const config = await this.prisma.conferenceConfig.findFirst({
      orderBy: { createdAt: "desc" },
      select: { acceptThreshold: true },
    });
    return config?.acceptThreshold ?? 70;
  }
}
