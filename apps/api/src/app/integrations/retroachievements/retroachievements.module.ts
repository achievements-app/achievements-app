import { BullModule } from "@nestjs/bull";
import { Module } from "@nestjs/common";

import { RetroachievementsDataService } from "./retroachievements-data.service";
import { RetroachievementsService } from "./retroachievements.service";
import { RetroachievementsProcessor } from "./retroachievements.processor";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "retroachievements",
      limiter: {
        duration: 5000,
        max: 5
      }
    })
  ],
  providers: [
    RetroachievementsDataService,
    RetroachievementsService,
    RetroachievementsProcessor
  ],
  exports: [RetroachievementsService]
})
export class RetroachievementsModule {}
