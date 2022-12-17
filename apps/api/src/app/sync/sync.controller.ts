import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param
} from "@nestjs/common";
import { Queue } from "bull";
import { InjectQueue } from "@nestjs/bull";

import { DbService } from "../db/db.service";
import type { SyncUserGamesPayload } from "./models";

@Controller("sync")
export class SyncController {
  #logger = new Logger(SyncController.name);

  constructor(
    @InjectQueue("sync")
    private readonly syncQueue: Queue,
    private readonly dbService: DbService
  ) {}

  @Get("retroachievements/:userName")
  async syncRetroachievementsUserName(@Param("userName") userName: string) {
    const foundTrackedAccount =
      await this.dbService.findTrackedAccountByAccountUserName("RA", userName);

    if (!foundTrackedAccount) {
      throw new HttpException("No tracked account.", HttpStatus.NOT_FOUND);
    }
  }

  @Get()
  async ping() {
    const foundTrackedAccount = await this.dbService.trackedAccount.findFirst({
      where: {
        gamingService: "RA",
        user: {
          userName: "wc"
        }
      }
    });

    if (foundTrackedAccount) {
      const payload = { trackedAccount: foundTrackedAccount };

      this.#logger.log(
        `QUEUEING JOB syncUserGames ${JSON.stringify(payload)}.`
      );
      const newJob = await this.syncQueue.add("syncUserGames", payload);
      this.#logger.log(`QUEUED JOB ${newJob.id} ${newJob.name}.`);
    }

    return { status: "ok" };
  }
}
