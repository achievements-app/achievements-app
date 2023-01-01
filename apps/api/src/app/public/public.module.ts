import { Module } from "@nestjs/common";

import { DbModule } from "@/api/shared/db/db.module";

import { PublicController } from "./public.controller";
import { PublicService } from "./public.service";

@Module({
  imports: [DbModule],
  controllers: [PublicController],
  providers: [PublicService]
})
export class PublicModule {}
