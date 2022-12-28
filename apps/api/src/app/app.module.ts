import { BullModule } from "@nestjs/bull";
import { Module } from "@nestjs/common";

import { AppController } from "./app.controller";
import { SyncModule } from "./sync/sync.module";

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        port: Number(process.env["REDISPORT"]),
        host: process.env["REDISHOST"],
        username: process.env["REDISUSER"],
        password: process.env["REDISPASSWORD"]
      }
    }),

    SyncModule
  ],
  controllers: [AppController]
})
export class AppModule {}
