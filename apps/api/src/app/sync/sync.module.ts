import { BullModule } from "@nestjs/bull";
import { Module } from "@nestjs/common";

import { RetroachievementsModule } from "../integrations/retroachievements/retroachievements.module";
import { SyncController } from "./sync.controller";
import { SyncProcessor } from "./sync.processor";
import { DbModule } from "../db/db.module";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "sync"
    }),
    RetroachievementsModule,
    DbModule
  ],
  controllers: [SyncController],
  providers: [SyncProcessor]
})
export class SyncModule {}
