import { Module } from "@nestjs/common";

import { DbModule } from "@/api/shared/db/db.module";

import { TrackedEventsService } from "./tracked-events.service";

@Module({
  imports: [DbModule],
  providers: [TrackedEventsService],
  exports: [TrackedEventsService]
})
export class TrackedEventsModule {}
