import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";

export interface ConferenceConfigDto {
  conferenceName: string;
  submitStartAt: string;
  submitEndAt: string;
  reviewDays: number;
  acceptThreshold: number;
  weightInnovation: number;
  weightScience: number;
  weightWriting: number;
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
          conferenceName: dto.conferenceName,
          submitStartAt: new Date(dto.submitStartAt),
          submitEndAt: new Date(dto.submitEndAt),
          reviewDays: dto.reviewDays,
          acceptThreshold: dto.acceptThreshold,
          weightInnovation: dto.weightInnovation,
          weightScience: dto.weightScience,
          weightWriting: dto.weightWriting,
        },
      });
    }
    return this.prisma.conferenceConfig.create({
      data: {
        conferenceName: dto.conferenceName,
        submitStartAt: new Date(dto.submitStartAt),
        submitEndAt: new Date(dto.submitEndAt),
        reviewDays: dto.reviewDays,
        acceptThreshold: dto.acceptThreshold,
        weightInnovation: dto.weightInnovation,
        weightScience: dto.weightScience,
        weightWriting: dto.weightWriting,
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
