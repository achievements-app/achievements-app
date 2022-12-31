import { BullModule } from "@nestjs/bull";
import { Module } from "@nestjs/common";

import { DbModule } from "@/api/shared/db/db.module";
import { PsnModule } from "@/api/shared/integrations/psn/psn.module";
import { RetroachievementsModule } from "@/api/shared/integrations/retroachievements/retroachievements.module";
import { XboxModule } from "@/api/shared/integrations/xbox/xbox.module";
import { LoggerModule } from "@/api/shared/logger/logger.module";

import { SyncController } from "./sync.controller";
import { SyncProcessor } from "./sync.processor";
import { SyncService } from "./sync.service";
import { SyncQueueingService } from "./sync-queueing.service";
import { SyncSchedulerService } from "./sync-scheduler.service";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "sync"
    }),

    DbModule,
    RetroachievementsModule,
    XboxModule,
    PsnModule,
    LoggerModule
  ],
  controllers: [SyncController],
  providers: [
    SyncProcessor,
    SyncService,
    SyncQueueingService,
    SyncSchedulerService
  ]
})
export class SyncModule {}
