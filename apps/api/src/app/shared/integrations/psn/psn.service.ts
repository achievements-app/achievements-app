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
    this.#logger.log(
      `Adding title and progress to DB for PSN:${trackedAccount.accountUserName}:${targetUserGame.name}`
    );

    const completeUserGameMetadata = await this.#fetchCompleteUserGameMetadata(
      trackedAccount.serviceAccountId,
      targetUserGame
    );

    const addedGame = await this.dbService.addMappedCompleteGame(
      completeUserGameMetadata
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
      `Added title as ${addedGame.id} and progress as ${newUserGameProgress.id} to DB for PSN:${trackedAccount.accountUserName}:${targetUserGame.name}`
    );
  }

  async getMissingAndPresentUserPsnGames(
    userAccountId: string,
    userName: string
  ) {
    this.#logger.log(
      `Getting missing and present games for PSN:${userName}:${userAccountId}`
    );

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
      `PSN:${userName}:${userAccountId} has ${allUserGames.length} games tracked on PSN. ${existingGameServiceTitleIds.length} of ${allUserGames.length} are stored in our DB.`
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
    this.#logger.log(
      `Getting title IDs needing a progress update for PSN:${trackedAccount.accountUserName}:${trackedAccount.serviceAccountId}`
    );

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

        this.#logger.verbose(
          `Missing UserGameProgress for PSN:${trackedAccount.accountUserName}:${userReportedGame.name}. Tracking ${storedEarnedAchievementCount} of ${reportedEarnedAchievementCount} earned achievements.`
        );

        serviceTitleIdsNeedingUpdate.push(userReportedGame.serviceTitleId);
      }
    }

    this.#logger.log(
      `PSN:${trackedAccount.accountUserName}:${trackedAccount.serviceAccountId} has ${serviceTitleIdsNeedingUpdate.length} title IDs needing a progress update`
    );

    return serviceTitleIdsNeedingUpdate;
  }

  async updatePsnTitleAndProgressInDb(
    trackedAccount: TrackedAccount,
    targetUserGame: MappedGame
  ) {
    this.#logger.log(
      `Updating ${targetUserGame.name} title and progress for PSN:${trackedAccount.accountUserName}:${trackedAccount.serviceAccountId}`
    );

    const completeUserGameMetadata = await this.#fetchCompleteUserGameMetadata(
      trackedAccount.serviceAccountId,
      targetUserGame
    );

    const updatedGame = await this.dbService.updateMappedCompleteGame(
      completeUserGameMetadata
    );

    const existingUserGameProgress =
      await this.dbService.findCompleteUserGameProgress(
        trackedAccount.id,
        updatedGame.id
      );

    const earnedAchievements = completeUserGameMetadata.achievements.filter(
      (achievement) => achievement.isEarned
    );

    if (!existingUserGameProgress) {
      await this.dbService.addNewUserGameProgress(
        updatedGame.id,
        trackedAccount,
        earnedAchievements,
        updatedGame.name
      );
    } else {
      const reportedEarnedAchievementsCount = earnedAchievements.length;
      const storedEarnedAchievementsCount =
        existingUserGameProgress?.earnedAchievements?.length ?? 0;

      this.#logger.log(
        `${trackedAccount.gamingService}:${trackedAccount.accountUserName} has earned ${reportedEarnedAchievementsCount} achievements for ${updatedGame.name}. We are currently storing ${storedEarnedAchievementsCount}`
      );

      if (reportedEarnedAchievementsCount !== storedEarnedAchievementsCount) {
        await this.dbService.updateExistingUserGameProgress(
          existingUserGameProgress,
          earnedAchievements
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
    this.#logger.log(
      `Fetching complete user game metadata for PSN:${mappedGame.name}:${userAccountId}`
    );

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

    this.#logger.log(
      `Fetched complete user game metadata for PSN:${mappedGame.name}:${userAccountId}`
    );

    return {
      ...mappedGame,
      achievements: mappedGameAchievements
    };
  }

  async #fetchUserPlayedGames(userAccountId: string) {
    this.#logger.log(
      `Fetching non-hidden user played games for PSN:${userAccountId}`
    );

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

    const withoutHiddenTitles = accumulatedTitles.filter(
      (title) => title.hiddenFlag !== true
    );

    this.#logger.log(
      `Fetched ${withoutHiddenTitles.length} non-hidden user played games for PSN:${userAccountId}`
    );

    return withoutHiddenTitles.map(mapTrophyTitleToStoredGame);
  }
}
