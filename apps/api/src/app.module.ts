import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { resolve } from "path";
import { AuthModule } from "./auth/auth.module";
import { BlockchainModule } from "./blockchain/blockchain.module";
import { PrismaModule } from "./common/prisma.module";
import { HealthController } from "./health.controller";
import { PapersModule } from "./papers/papers.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(process.cwd(), ".env"),
        resolve(process.cwd(), "../.env"),
        resolve(process.cwd(), "../../.env"),
      ],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    PapersModule,
    ReviewsModule,
    BlockchainModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
