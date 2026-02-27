import { Module } from "@nestjs/common";
import { ConfConfigController } from "./conf-config.controller";
import { ConfConfigService } from "./conf-config.service";

@Module({
  controllers: [ConfConfigController],
  providers: [ConfConfigService],
  exports: [ConfConfigService],
})
export class ConfConfigModule {}
