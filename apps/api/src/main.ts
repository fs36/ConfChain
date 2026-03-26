import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());

  // CORS_ORIGIN 支持多个来源，逗号分隔，例如：
  //   CORS_ORIGIN=https://confchain.vercel.app,https://confchain-git-main.vercel.app
  // 未设置时开发环境允许所有来源（true）
  const corsOriginEnv = process.env.CORS_ORIGIN;
  const corsOrigin: string | string[] | boolean = corsOriginEnv
    ? corsOriginEnv.split(",").map((o) => o.trim())
    : true;

  app.enableCors({ origin: corsOrigin, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.setGlobalPrefix("api");
  await app.listen(3000);
}

bootstrap();
