import { Module } from "@nestjs/common";

import { DbModule } from "@/api/shared/db/db.module";
import { TrackedEventsModule } from "@/api/shared/tracked-events/tracked-events.module";

import { XboxService } from "./xbox.service";
import { XboxDataService } from "./xbox-data.service";

@Module({
  imports: [DbModule, TrackedEventsModule],
  providers: [XboxService, XboxDataService],
  exports: [XboxService, XboxDataService]
})
export class XboxModule {}
