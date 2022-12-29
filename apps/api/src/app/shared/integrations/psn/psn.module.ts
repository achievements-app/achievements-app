import { Module } from "@nestjs/common";

import { PsnService } from "./psn.service";
import { PsnAuthService } from "./psn-auth.service";
import { PsnDataService } from "./psn-data.service";

@Module({
  providers: [PsnAuthService, PsnService, PsnDataService],
  exports: [PsnService, PsnDataService]
})
export class PsnModule {}
