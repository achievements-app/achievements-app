import { Module } from "@nestjs/common";

import { XboxDataService } from "./xbox-data.service";

@Module({
  providers: [XboxDataService],
  exports: [XboxDataService]
})
export class XboxModule {}
