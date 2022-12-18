import { BullModule } from "@nestjs/bull";
import { Module } from "@nestjs/common";

import { DbModule } from "../db/db.module";
import { RetroachievementsModule } from "../integrations/retroachievements/retroachievements.module";
import { LoggerModule } from "../shared/logger/logger.module";
import { SyncController } from "./sync.controller";
import { SyncProcessor } from "./sync.processor";
import { SyncService } from "./sync.service";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "sync"
    }),

    DbModule,
    RetroachievementsModule,
    LoggerModule
  ],
  controllers: [SyncController],
  providers: [SyncProcessor, SyncService]
})
export class SyncModule {}
