import { Module } from "@nestjs/common";

import { RetroachievementsModule } from "../integrations/retroachievements/retroachievements.module";
import { SyncController } from "./sync.controller";

@Module({
  imports: [RetroachievementsModule],
  controllers: [SyncController]
})
export class SyncModule {}
