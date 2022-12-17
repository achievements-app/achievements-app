import { BullModule } from "@nestjs/bull";
import { Module } from "@nestjs/common";

import { DbModule } from "../../db/db.module";
import { RetroachievementsProcessor } from "./retroachievements.processor";
import { RetroachievementsDataService } from "./retroachievements-data.service";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "retroachievements"
    }),
    DbModule
  ],
  providers: [RetroachievementsDataService, RetroachievementsProcessor],
  exports: [RetroachievementsDataService]
})
export class RetroachievementsModule {}
