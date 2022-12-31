import { Injectable } from "@nestjs/common";
import type {
  TitleTrophiesResponse,
  TrophyTitle,
  UserTrophiesEarnedForTitleResponse
} from "psn-api";

import type {
  MappedCompleteGame,
  MappedGame
} from "@achievements-app/data-access-common-models";
import type { TrackedAccount } from "@achievements-app/data-access-db";

import { DbService } from "@/api/shared/db/db.service";
import { Logger } from "@/api/shared/logger/logger.service";

import { PsnDataService } from "./psn-data.service";
import { mapTrophyResponsesToMappedGameAchievements } from "./utils/mapTrophyResponsesToMappedGameAchievements";
import { mapTrophyTitleToStoredGame } from "./utils/mapTrophyTitleToStoredGame";

@Injectable()
export class PsnService {
  #logger = new Logger(PsnService.name);

  constructor(
    private readonly dataService: PsnDataService,
    private readonly dbService: DbService
  ) {}

  async addPsnTitleAndProgressToDb(
    trackedAccount: TrackedAccount,
    targetUserGame: MappedGame
  ) {
    const completeUserGameMetadata = await this.#fetchCompleteUserGameMetadata(
      trackedAccount.serviceAccountId,
      targetUserGame
    );

    this.#logger.log(
      `Fetched complete metadata for PSN game ${targetUserGame.name} for user ${trackedAccount.accountUserName}`
    );

    const addedGame = await this.dbService.addMappedCompleteGame(
      completeUserGameMetadata
    );

    this.#logger.log(`Added PSN title ${addedGame.name} to DB`);

    this.#logger.log(
      `Creating UserGameProgress for ${trackedAccount.gamingService}:${trackedAccount.accountUserName}:${addedGame.id}:${addedGame.name}`
    );

    const earnedAchievements = completeUserGameMetadata.achievements.filter(
      (achievement) => achievement.isEarned
    );

    const newUserGameProgress = await this.dbService.addNewUserGameProgress(
      addedGame.id,
      trackedAccount,
      earnedAchievements
    );

    this.#logger.log(
      `Created UserGameProgress for ${trackedAccount.gamingService}:${trackedAccount.accountUserName}:${addedGame.id}:${addedGame.name} as ${newUserGameProgress.id}`
    );
  }

  async getMissingAndPresentUserPsnGames(
    userAccountId: string,
    userName: string
  ) {
    // First, fetch the list of all the user games. From this, we'll
    // have all the title IDs so we can check our database for what
    // games we have and what games we're missing.
    const allUserGames = await this.#fetchUserPlayedGames(userAccountId);

    const allUserServiceTitleIds = allUserGames.map(
      (userGame) => userGame.serviceTitleId
    );

    const { existingGameServiceTitleIds, missingGameServiceTitleIds } =
      await this.dbService.getMultipleGamesExistenceStatus(
        "PSN",
        allUserServiceTitleIds
      );

    this.#logger.log(
      `${userName}:${userAccountId} has ${allUserGames.length} games tracked on PSN. ${existingGameServiceTitleIds.length} of ${allUserGames.length} are stored in our DB.`
    );

    return {
      existingGameServiceTitleIds,
      missingGameServiceTitleIds,
      allUserGames
    };
  }

  async getPsnTitleIdsNeedingUserProgressUpdate(
    trackedAccount: TrackedAccount,
    userReportedGames: MappedGame[]
  ) {
    const serviceTitleIdsNeedingUpdate: string[] = [];

    const allPsnUserGameProgress =
      await this.dbService.db.userGameProgress.findMany({
        where: {
          trackedAccountId: trackedAccount.id,
          game: { gamingService: "PSN" }
        },
        include: {
          earnedAchievements: { select: { id: true } },
          game: {
            select: { serviceTitleId: true }
          }
        }
      });

    for (const userReportedGame of userReportedGames) {
      const doesGameExist = await this.dbService.db.game.findFirst({
        where: { serviceTitleId: userReportedGame.serviceTitleId }
      });

      const foundUserGameProgress = allPsnUserGameProgress.find(
        (userGameProgress) =>
          userGameProgress.game.serviceTitleId ===
          userReportedGame.serviceTitleId
      );

      const isMissingUserGameProgress =
        !foundUserGameProgress ||
        foundUserGameProgress?.earnedAchievements?.length === undefined;

      const isAchievementCountMismatched =
        foundUserGameProgress?.earnedAchievements?.length !==
        userReportedGame?.knownUserEarnedAchievementCount;

      if (
        doesGameExist &&
        (isMissingUserGameProgress || isAchievementCountMismatched)
      ) {
        const storedEarnedAchievementCount =
          foundUserGameProgress?.earnedAchievements?.length ?? 0;
        const reportedEarnedAchievementCount =
          userReportedGame?.knownUserEarnedAchievementCount ?? 0;

        this.#logger.log(
          `Missing UserGameProgress for PSN:${trackedAccount.accountUserName}:${userReportedGame.name}. Tracking ${storedEarnedAchievementCount} of ${reportedEarnedAchievementCount} earned achievements.`
        );

        serviceTitleIdsNeedingUpdate.push(userReportedGame.serviceTitleId);
      }
    }

    return serviceTitleIdsNeedingUpdate;
  }

  async updatePsnTitleAndProgressInDb(
    trackedAccount: TrackedAccount,
    targetUserGame: MappedGame
  ) {
    this.#logger.log(
      `Need to update PSN title ${targetUserGame.name} for ${trackedAccount.accountUserName}`
    );

    const completeUserGameMetadata = await this.#fetchCompleteUserGameMetadata(
      trackedAccount.serviceAccountId,
      targetUserGame
    );

    this.#logger.log(
      `Fetched complete metadata for PSN title ${targetUserGame.name} for ${trackedAccount.accountUserName}`
    );

    const updatedGame = await this.dbService.updateMappedCompleteGame(
      completeUserGameMetadata
    );

    this.#logger.log(`Updated metadata for PSN title ${targetUserGame.name}`);

    const existingUserGameProgress =
      await this.dbService.findCompleteUserGameProgress(
        trackedAccount.id,
        updatedGame.id
      );

    const earnedAchievements = completeUserGameMetadata.achievements.filter(
      (achievement) => achievement.isEarned
    );

    if (!existingUserGameProgress) {
      this.#logger.log(
        `Creating UserGameProgress for ${trackedAccount.gamingService}:${trackedAccount.accountUserName}:${updatedGame.id}:${updatedGame.name}`
      );

      const newUserGameProgress = await this.dbService.addNewUserGameProgress(
        updatedGame.id,
        trackedAccount,
        earnedAchievements
      );

      this.#logger.log(
        `Created UserGameProgress for ${trackedAccount.gamingService}:${trackedAccount.accountUserName}:${updatedGame.id}:${updatedGame.name} as ${newUserGameProgress.id}`
      );
    } else {
      this.#logger.log(
        `Updating UserGameProgress for ${trackedAccount.gamingService}:${trackedAccount.accountUserName}:${updatedGame.id}:${updatedGame.name}`
      );

      const reportedEarnedAchievementsCount = earnedAchievements.length;
      const storedEarnedAchievementsCount =
        existingUserGameProgress?.earnedAchievements?.length ?? 0;

      this.#logger.log(
        `${trackedAccount.gamingService}:${trackedAccount.accountUserName} has earned ${reportedEarnedAchievementsCount} achievements for ${updatedGame.name}. We are currently storing ${storedEarnedAchievementsCount}`
      );

      if (reportedEarnedAchievementsCount !== storedEarnedAchievementsCount) {
        const updatedUserGameProgress =
          await this.dbService.updateExistingUserGameProgress(
            existingUserGameProgress,
            earnedAchievements
          );

        this.#logger.log(
          `Updated UserGameProgress ${updatedUserGameProgress.id} for ${trackedAccount.gamingService}:${trackedAccount.accountUserName}:${updatedGame.id}:${updatedGame.name}`
        );
      }
    }
  }

  async useTrackedAccountPsnAccountId(
    trackedAccount: TrackedAccount
  ): Promise<TrackedAccount> {
    if (trackedAccount.serviceAccountId) {
      return trackedAccount;
    }

    // If we don't already have the account's Account ID, retrieve it
    // from PSN and store it in the database.
    const accountId = await this.dataService.fetchAccountIdFromUserName(
      trackedAccount.accountUserName
    );
    return await this.dbService.storeTrackedAccountUniqueAccountId(
      trackedAccount,
      accountId
    );
  }

  async #fetchCompleteUserGameMetadata(
    userAccountId: string,
    mappedGame: MappedGame
  ): Promise<MappedCompleteGame> {
    const parallelApiCalls = [
      this.dataService.fetchAllTitleTrophies(
        mappedGame.serviceTitleId,
        mappedGame.psnServiceName as "trophy" | "trophy2"
      ),
      this.dataService.fetchUserEarnedTrophiesForTitle(
        userAccountId,
        mappedGame.serviceTitleId,
        mappedGame.psnServiceName as "trophy" | "trophy2"
      )
    ];

    const [allTitleTrophiesResponse, userEarnedTrophiesForTitleResponse] =
      (await Promise.all(parallelApiCalls)) as [
        TitleTrophiesResponse,
        UserTrophiesEarnedForTitleResponse
      ];

    const mappedGameAchievements = mapTrophyResponsesToMappedGameAchievements(
      allTitleTrophiesResponse,
      userEarnedTrophiesForTitleResponse
    );

    return {
      ...mappedGame,
      achievements: mappedGameAchievements
    };
  }

  async #fetchUserPlayedGames(userAccountId: string) {
    const accumulatedTitles: TrophyTitle[] = [];

    // If the user has more than the max allowed to be returned on a
    // single call, the API will include an "offset" pointing to where the
    // next page starts. To get all the user's games, we need to make a
    // call each time we have an offset value. When we've identified that
    // we have all the user's games, set the `currentOffset` value to
    // `null` to stop the while loop.
    let currentOffset: number | null = 0;
    while (currentOffset !== null) {
      const { trophyTitles, totalItemCount, nextOffset } =
        await this.dataService.fetchTitleHistoryByAccountId(
          userAccountId,
          currentOffset
        );

      accumulatedTitles.push(...trophyTitles);

      if (!nextOffset || accumulatedTitles.length === totalItemCount) {
        currentOffset = null;
      } else {
        currentOffset = nextOffset;
      }
    }

    return accumulatedTitles
      .filter((title) => title.hiddenFlag !== true)
      .map(mapTrophyTitleToStoredGame);
  }
}
