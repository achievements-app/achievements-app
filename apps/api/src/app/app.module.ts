import { BullModule } from "@nestjs/bull";
import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { SentryModule } from "@ntegral/nestjs-sentry";

import { AppController } from "./app.controller";
import { PublicModule } from "./public/public.module";
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
    SentryModule.forRoot({
      dsn: process.env["SENTRY_DSN"] ?? "sentry_io_dsn",
      environment: process.env.NODE_ENV
    }),
    ScheduleModule.forRoot(),

    SyncModule,
    PublicModule
  ],
  controllers: [AppController]
})
export class AppModule {}
