import { InjectQueue } from "@nestjs/bull";
import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param
} from "@nestjs/common";
import { Queue } from "bull";

import { DbService } from "@/api/shared/db/db.service";
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

  @Get("full")
  async syncAll() {
    const allTrackedAccounts =
      await this.dbService.db.trackedAccount.findMany();

    for (const trackedAccount of allTrackedAccounts) {
      if (trackedAccount.gamingService === "RA") {
        await this.syncRetroachievementsUserName(
          trackedAccount.accountUserName
        );
      } else if (trackedAccount.gamingService === "XBOX") {
        await this.syncXboxUserName(trackedAccount.accountUserName);
      }
    }

    return { status: "success" };
  }

  @Get("xbox/full")
  async syncXboxAll() {
    const allTrackedAccounts = await this.dbService.db.trackedAccount.findMany({
      where: { gamingService: "XBOX" }
    });

    await this.syncQueue.addBulk(
      allTrackedAccounts.map((trackedAccount) => ({
        name: syncJobNames.syncXboxUserGames,
        data: { trackedAccount }
      }))
    );

    return { status: "success" };
  }

  @Get("retroachievements/full")
  async syncRetroachievementsAll() {
    const allTrackedAccounts = await this.dbService.db.trackedAccount.findMany({
      where: { gamingService: "RA" }
    });

    for (const trackedAccount of allTrackedAccounts) {
      await this.syncRetroachievementsUserName(trackedAccount.accountUserName);
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
      payload,
      { attempts: 6, backoff: 60000 }
    );
    this.#logger.logQueuedJob(newJob.name, newJob.id);

    return { status: "success" };
  }

  @Get("xbox/gamerscore/:userName")
  async getXboxUserGamerscore(@Param("userName") userName: string) {
    const foundTrackedAccount =
      await this.dbService.findTrackedAccountByAccountUserName(
        "XBOX",
        userName
      );

    const userEarnedAchievements =
      await this.dbService.db.userEarnedAchievement.findMany({
        where: {
          gameProgressEntity: { trackedAccountId: foundTrackedAccount.id }
        },
        include: {
          achievement: true
        }
      });

    let gamerscore = 0;
    for (const userEarnedAchievement of userEarnedAchievements) {
      gamerscore += userEarnedAchievement.achievement.vanillaPoints;
    }

    return { gamerscore, count: userEarnedAchievements.length };
  }

  @Get("xbox/:userName")
  async syncXboxUserName(@Param("userName") userName: string) {
    const foundTrackedAccount =
      await this.dbService.findTrackedAccountByAccountUserName(
        "XBOX",
        userName
      );

    if (!foundTrackedAccount) {
      this.#logger.warn(`No tracked XBOX account for ${userName}`);
      throw new HttpException("No tracked account.", HttpStatus.NOT_FOUND);
    }

    const payload: SyncUserGamesPayload = {
      trackedAccount: foundTrackedAccount
    };

    this.#logger.logQueueingJob(syncJobNames.syncXboxUserGames, payload);
    const newJob = await this.syncQueue.add(
      syncJobNames.syncXboxUserGames,
      payload,
      { attempts: 6, backoff: 60000 }
    );
    this.#logger.logQueuedJob(newJob.name, newJob.id);

    return { status: "success" };
  }
}
