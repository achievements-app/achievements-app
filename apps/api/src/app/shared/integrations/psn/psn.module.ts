import { Module } from "@nestjs/common";

import { DbModule } from "@/api/shared/db/db.module";

import { PsnService } from "./psn.service";
import { PsnAuthService } from "./psn-auth.service";
import { PsnDataService } from "./psn-data.service";

@Module({
  imports: [DbModule],
  providers: [PsnAuthService, PsnService, PsnDataService],
  exports: [PsnService, PsnDataService]
})
export class PsnModule {}
