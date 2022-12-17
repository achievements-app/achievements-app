import { InjectQueue } from "@nestjs/bull";
import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param
} from "@nestjs/common";
import { Queue } from "bull";

import { DbService } from "@/api/db/db.service";
import { Logger } from "@/api/shared/logger/logger.service";

import type { SyncQueuePayload, SyncUserGamesPayload } from "./models";
import { syncJobNames } from "./sync-job-names";

@Controller("sync")
export class SyncController {
  #logger = new Logger(SyncController.name);

  constructor(
    @InjectQueue("sync")
    private readonly syncQueue: Queue<SyncQueuePayload>,
    private readonly dbService: DbService
  ) {}

  @Get("retroachievements/full")
  async syncRetroachievementsAll() {
    const allTrackedAccounts = await this.dbService.trackedAccount.findMany({
      where: {
        gamingService: "RA"
      }
    });

    for (const trackedAccount of allTrackedAccounts) {
      const payload: SyncUserGamesPayload = {
        trackedAccount
      };

      this.#logger.logQueueingJob(
        syncJobNames.syncRetroachievementsUserGames,
        payload
      );
      const newJob = await this.syncQueue.add(
        syncJobNames.syncRetroachievementsUserGames,
        payload,
        { attempts: 3, backoff: 60000 }
      );
      this.#logger.logQueuedJob(newJob.name, newJob.id);
    }

    return { status: "success" };
  }

  @Get("retroachievements/:userName")
  async syncRetroachievementsUserName(@Param("userName") userName: string) {
    const foundTrackedAccount =
      await this.dbService.findTrackedAccountByAccountUserName("RA", userName);

    if (!foundTrackedAccount) {
      this.#logger.warn(`No tracked RA account for ${userName}`);
      throw new HttpException("No tracked account.", HttpStatus.NOT_FOUND);
    }

    const payload: SyncUserGamesPayload = {
      trackedAccount: foundTrackedAccount
    };

    this.#logger.logQueueingJob(
      syncJobNames.syncRetroachievementsUserGames,
      payload
    );
    const newJob = await this.syncQueue.add(
      syncJobNames.syncRetroachievementsUserGames,
      payload
    );
    this.#logger.logQueuedJob(newJob.name, newJob.id);

    return { status: "success" };
  }
}
