import { BullModule } from "@nestjs/bull";
import { Module } from "@nestjs/common";

import { RetroachievementsDataService } from "./retroachievements-data.service";
import { RetroachievementsService } from "./retroachievements.service";
import { RetroachievementsProcessor } from "./retroachievements.processor";
import { DbModule } from "../../db/db.module";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "retroachievements"
    }),
    DbModule
  ],
  providers: [
    RetroachievementsDataService,
    RetroachievementsService,
    RetroachievementsProcessor
  ],
  exports: [RetroachievementsService, RetroachievementsDataService]
})
export class RetroachievementsModule {}
