import { Module } from "@nestjs/common";

import { DbModule } from "@/api/shared/db/db.module";
import { TrackedEventsModule } from "@/api/shared/tracked-events/tracked-events.module";

import { RetroachievementsService } from "./retroachievements.service";
import { RetroachievementsDataService } from "./retroachievements-data.service";

@Module({
  imports: [DbModule, TrackedEventsModule],
  providers: [RetroachievementsService, RetroachievementsDataService],
  exports: [RetroachievementsService]
})
export class RetroachievementsModule {}
