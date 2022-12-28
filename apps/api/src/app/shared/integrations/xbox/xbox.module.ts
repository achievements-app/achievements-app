import { Module } from "@nestjs/common";

import { XboxService } from "./xbox.service";
import { XboxDataService } from "./xbox-data.service";

@Module({
  providers: [XboxService, XboxDataService],
  exports: [XboxService, XboxDataService]
})
export class XboxModule {}
