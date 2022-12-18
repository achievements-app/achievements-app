import { BullModule } from "@nestjs/bull";
import { Module } from "@nestjs/common";

import { DbModule } from "@/api/shared/db/db.module";

import { RetroachievementsDataService } from "./retroachievements-data.service";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "retroachievements"
    }),
    DbModule
  ],
  providers: [RetroachievementsDataService],
  exports: [RetroachievementsDataService]
})
export class RetroachievementsModule {}
