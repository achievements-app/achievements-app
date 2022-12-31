import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param
} from "@nestjs/common";

import type {
  GameAchievement,
  UserEarnedAchievement
} from "@achievements-app/data-access-db";

import { DbService } from "@/api/shared/db/db.service";
import { Logger } from "@/api/shared/logger/logger.service";

import type { PublicUserGameProgress } from "./models/public-user-game-progress.model";

@Controller("public")
export class PublicController {
  #logger = new Logger(PublicController.name);

  constructor(private readonly dbService: DbService) {}

  @Get("user/psn/:userName")
  async getPsnUserProgress(@Param("userName") userName: string) {
    const foundTrackedAccount =
      await this.dbService.findTrackedAccountByAccountUserName("PSN", userName);

    if (!foundTrackedAccount) {
      this.#logger.warn(`No tracked PSN account for ${userName}`);
      throw new HttpException("No tracked account.", HttpStatus.NOT_FOUND);
    }

    const allCompleteUserGameProgresses =
      await this.dbService.db.userGameProgress.findMany({
        where: { trackedAccountId: foundTrackedAccount.id },
        include: {
          earnedAchievements: { include: { achievement: true } },
          game: { include: { achievements: true } }
        }
      });

    const publicUserGameProgresses: PublicUserGameProgress[] = [];

    for (const { game, earnedAchievements } of allCompleteUserGameProgresses) {
      const gameName = game.name;
      const platforms = game.gamePlatforms;
      const gamingService = game.gamingService;

      const mergedAchievements: Array<
        GameAchievement & UserEarnedAchievement & { isEarned: boolean }
      > = [];
      for (const achievement of game.achievements) {
        const foundEarnedAchievement = earnedAchievements.find(
          (earnedAchievement) =>
            earnedAchievement.achievement.id === achievement.id
        );

        mergedAchievements.push({
          ...achievement,
          ...foundEarnedAchievement,
          isEarned: foundEarnedAchievement ? true : false
        });
      }

      const allBronzeTrophies = mergedAchievements.filter(
        (achievement) => achievement.psnTrophyKind === "Bronze"
      );
      const allSilverTrophies = mergedAchievements.filter(
        (achievement) => achievement.psnTrophyKind === "Silver"
      );
      const allGoldTrophies = mergedAchievements.filter(
        (achievement) => achievement.psnTrophyKind === "Gold"
      );
      const allPlatinumTrophies = mergedAchievements.filter(
        (achievement) => achievement.psnTrophyKind === "Platinum"
      );

      const gameTrophyTypeCounts = {
        bronze: allBronzeTrophies.length,
        silver: allSilverTrophies.length,
        gold: allGoldTrophies.length,
        platinum: allPlatinumTrophies.length
      };

      const allEarnedBronzeTrophies = allBronzeTrophies.filter(
        (trophy) => trophy.isEarned
      );
      const allEarnedSilverTrophies = allSilverTrophies.filter(
        (trophy) => trophy.isEarned
      );
      const allEarnedGoldTrophies = allGoldTrophies.filter(
        (trophy) => trophy.isEarned
      );
      const allEarnedPlatinumTrophies = allPlatinumTrophies.filter(
        (trophy) => trophy.isEarned
      );

      const userEarnedTrophyTypeCounts = {
        bronze: allEarnedBronzeTrophies.length,
        silver: allEarnedSilverTrophies.length,
        gold: allEarnedGoldTrophies.length,
        platinum: allEarnedPlatinumTrophies.length
      };

      publicUserGameProgresses.push({
        gameName,
        platforms,
        gamingService,
        gameTrophyTypeCounts,
        userEarnedTrophyTypeCounts,
        achievementsList: mergedAchievements.map((mergedAchievement) => ({
          isEarned: mergedAchievement?.isEarned,
          earnedRate: mergedAchievement?.knownEarnerPercentage,
          type: mergedAchievement?.psnTrophyKind.toLowerCase() as any,
          earnedOn: mergedAchievement?.earnedOn?.toISOString()
        }))
      });
    }

    return publicUserGameProgresses;
  }

  @Get("user/retroachievements/:userName")
  async getRetroachievementsUserProgress(@Param("userName") userName: string) {
    const foundTrackedAccount =
      await this.dbService.findTrackedAccountByAccountUserName("RA", userName);

    if (!foundTrackedAccount) {
      this.#logger.warn(`No tracked RA account for ${userName}`);
      throw new HttpException("No tracked account.", HttpStatus.NOT_FOUND);
    }

    const allCompleteUserGameProgresses =
      await this.dbService.db.userGameProgress.findMany({
        where: { trackedAccountId: foundTrackedAccount.id },
        include: {
          earnedAchievements: { include: { achievement: true } },
          game: { include: { achievements: true } }
        }
      });

    const publicUserGameProgresses: PublicUserGameProgress[] = [];

    for (const { game, earnedAchievements } of allCompleteUserGameProgresses) {
      const gameName = game.name;
      const platforms = game.gamePlatforms;
      const gamingService = game.gamingService;

      const mergedAchievements: Array<
        GameAchievement & UserEarnedAchievement & { isEarned: boolean }
      > = [];
      for (const achievement of game.achievements) {
        const foundEarnedAchievement = earnedAchievements.find(
          (earnedAchievement) =>
            earnedAchievement.achievement.id === achievement.id
        );

        mergedAchievements.push({
          ...achievement,
          ...foundEarnedAchievement,
          isEarned: foundEarnedAchievement ? true : false
        });
      }

      publicUserGameProgresses.push({
        gameName,
        platforms,
        gamingService,
        achievementsList: mergedAchievements.map((mergedAchievement) => ({
          isEarned: mergedAchievement?.isEarned,
          earnedRate:
            (mergedAchievement.knownEarnerCount / game.knownPlayerCount) * 100,
          earnedOn: mergedAchievement?.earnedOn?.toISOString(),
          points: mergedAchievement.vanillaPoints
        }))
      });
    }

    return publicUserGameProgresses;
  }
}
