/* eslint-disable sonarjs/no-duplicate-string */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post
} from "@nestjs/common";

import type { GamingService } from "@achievements-app/data-access-db";

import { DbService } from "@/api/shared/db/db.service";
import { Logger } from "@/api/shared/logger/logger.service";

import type { PublicUserGameProgress } from "./models";
import { PublicService } from "./public.service";

@Controller("public")
export class PublicController {
  #logger = new Logger(PublicController.name);

  constructor(
    private readonly dbService: DbService,
    private readonly publicService: PublicService
  ) {}

  @Post("user/trackedAccount")
  async addTrackedAccount(
    @Body()
    newAccount: {
      gamingService: GamingService;
      userName: string;
      serviceAccountUserName: string;
    }
  ) {
    const foundUser = await this.dbService.db.user.findFirst({
      where: { userName: newAccount.userName }
    });

    return await this.dbService.db.trackedAccount.create({
      data: {
        userId: foundUser.id,
        accountUserName: newAccount.serviceAccountUserName,
        gamingService: newAccount.gamingService
      }
    });
  }

  @Get("user/:userName")
  async getAllUserProgress(
    @Param("userName") userName: string
  ): Promise<Record<string, PublicUserGameProgress[]>> {
    const allFoundTrackedAccounts =
      await this.dbService.db.trackedAccount.findMany({
        where: { user: { userName } }
      });

    if (!allFoundTrackedAccounts || allFoundTrackedAccounts.length === 0) {
      this.#logger.warn(`No tracked accounts for user ${userName}`);
      throw new HttpException("No tracked accounts.", HttpStatus.NOT_FOUND);
    }

    const allProgress: Record<string, PublicUserGameProgress[]> = {};

    for (const trackedAccount of allFoundTrackedAccounts) {
      const allPublicUserGameProgress =
        await this.publicService.getAllTrackedAccountPublicUserGameProgress(
          trackedAccount
        );

      allProgress[
        `${trackedAccount.gamingService}_${trackedAccount.accountUserName}`
      ] = allPublicUserGameProgress;
    }

    return allProgress;
  }

  @Get("user/high-priority")
  async getAllHighPriorityUsers() {
    return this.dbService.db.user.findMany({
      where: { syncPriority: "High" },
      select: { userName: true, discordId: true }
    });
  }

  @Get("user/psn/:userName")
  async getPsnUserProgress(
    @Param("userName") userName: string
  ): Promise<PublicUserGameProgress[]> {
    const foundTrackedAccount =
      await this.dbService.findTrackedAccountByAccountUserName("PSN", userName);

    if (!foundTrackedAccount) {
      this.#logger.warn(`No tracked PSN account for ${userName}`);
      throw new HttpException("No tracked account.", HttpStatus.NOT_FOUND);
    }

    return this.publicService.getAllTrackedAccountPublicUserGameProgress(
      foundTrackedAccount
    );
  }

  @Get("user/retroachievements/:userName")
  async getRetroachievementsUserProgress(
    @Param("userName") userName: string
  ): Promise<PublicUserGameProgress[]> {
    const foundTrackedAccount =
      await this.dbService.findTrackedAccountByAccountUserName("RA", userName);

    if (!foundTrackedAccount) {
      this.#logger.warn(`No tracked RA account for ${userName}`);
      throw new HttpException("No tracked account.", HttpStatus.NOT_FOUND);
    }

    return this.publicService.getAllTrackedAccountPublicUserGameProgress(
      foundTrackedAccount
    );
  }

  @Get("user/xbox/:userName")
  async getXboxUserProgress(
    @Param("userName") userName: string
  ): Promise<PublicUserGameProgress[]> {
    const foundTrackedAccount =
      await this.dbService.findTrackedAccountByAccountUserName(
        "XBOX",
        userName
      );

    if (!foundTrackedAccount) {
      this.#logger.warn(`No tracked XBOX account for ${userName}`);
      throw new HttpException("No tracked account.", HttpStatus.NOT_FOUND);
    }

    return this.publicService.getAllTrackedAccountPublicUserGameProgress(
      foundTrackedAccount
    );
  }

  @Delete("user/trackedAccount")
  async removeTrackedAccount(
    @Body()
    existingAccount: {
      gamingService: GamingService;
      serviceAccountUserName: string;
    }
  ) {
    const foundTrackedAccount =
      await this.dbService.db.trackedAccount.findFirst({
        where: {
          gamingService: existingAccount.gamingService,
          accountUserName: existingAccount.serviceAccountUserName
        }
      });

    if (foundTrackedAccount) {
      const allEarnedAchievements =
        await this.dbService.db.userEarnedAchievement.findMany({
          where: {
            gameProgressEntity: { trackedAccountId: foundTrackedAccount.id }
          }
        });

      await this.dbService.db.userEarnedAchievement.deleteMany({
        where: {
          id: {
            in: allEarnedAchievements.map(
              (earnedAchievement) => earnedAchievement.id
            )
          }
        }
      });

      await this.dbService.db.userGameProgress.deleteMany({
        where: { trackedAccountId: foundTrackedAccount.id }
      });

      await this.dbService.db.trackedAccount.delete({
        where: { id: foundTrackedAccount.id }
      });

      return { status: "success" };
    }
  }
}
