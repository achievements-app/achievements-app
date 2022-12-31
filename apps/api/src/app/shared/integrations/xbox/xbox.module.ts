import { Module } from "@nestjs/common";

import { DbModule } from "@/api/shared/db/db.module";

import { XboxService } from "./xbox.service";
import { XboxDataService } from "./xbox-data.service";

@Module({
  imports: [DbModule],
  providers: [XboxService, XboxDataService],
  exports: [XboxService, XboxDataService]
})
export class XboxModule {}
