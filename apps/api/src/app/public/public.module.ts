import { Module } from "@nestjs/common";

import { DbModule } from "@/api/shared/db/db.module";

import { PublicController } from "./public.controller";

@Module({
  imports: [DbModule],
  controllers: [PublicController]
})
export class PublicModule {}
