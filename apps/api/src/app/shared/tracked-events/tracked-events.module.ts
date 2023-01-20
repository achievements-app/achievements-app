import { Module } from "@nestjs/common";

import { DbModule } from "@/api/shared/db/db.module";

import { TrackedEventsController } from "./tracked-events.controller";
import { TrackedEventsService } from "./tracked-events.service";

@Module({
  imports: [DbModule],
  controllers: [TrackedEventsController],
  providers: [TrackedEventsService],
  exports: [TrackedEventsService]
})
export class TrackedEventsModule {}
