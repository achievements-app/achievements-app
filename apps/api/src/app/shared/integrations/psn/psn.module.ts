import { Module } from "@nestjs/common";

import { DbModule } from "@/api/shared/db/db.module";
import { TrackedEventsModule } from "@/api/shared/tracked-events/tracked-events.module";

import { PsnService } from "./psn.service";
import { PsnAuthService } from "./psn-auth.service";
import { PsnDataService } from "./psn-data.service";

@Module({
  imports: [DbModule, TrackedEventsModule],
  providers: [PsnAuthService, PsnService, PsnDataService],
  exports: [PsnService, PsnDataService]
})
export class PsnModule {}
