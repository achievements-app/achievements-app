import { Module } from "@nestjs/common";

import { RetroachievementsService } from "./retroachievements.service";
import { RetroachievementsDataService } from "./retroachievements-data.service";

@Module({
  providers: [RetroachievementsService, RetroachievementsDataService],
  exports: [RetroachievementsService]
})
export class RetroachievementsModule {}
