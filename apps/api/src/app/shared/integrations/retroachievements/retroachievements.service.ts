import { Injectable } from "@nestjs/common";

import type {
  MappedCompleteGame,
  MappedGame,
  MappedGameAchievement
} from "@achievements-app/data-access-common-models";
import type {
  Game,
  TrackedAccount,
  UserGameProgress
} from "@achievements-app/data-access-db";

import { DbService } from "@/api/shared/db/db.service";
import { Logger } from "@/api/shared/logger/logger.service";
import { TrackedEventsService } from "@/api/shared/tracked-events/tracked-events.service";

import { RetroachievementsDataService } from "./retroachievements-data.service";
import { mapAchievementToMappedGameAchievement } from "./utils/mapAchievementToMappedGameAchievement";
import { mapGameInfoExtendedToCompleteGame } from "./utils/mapGameInfoExtendedToCompleteGame";
import { mapUserGameCompletionToStoredGame } from "./utils/mapUserGameCompletionToStoredGame";
import { mapUserRecentlyPlayedGameEntityToMappedGame } from "./utils/mapUserRecentlyPlayedGameEntityToMappedGame";

@Injectable()
export class RetroachievementsService {
  #logger = new Logger(RetroachievementsService.name);

  constructor(
    private readonly dataService: RetroachievementsDataService,
    private readonly dbService: DbService,
    private readonly trackedEventsService: TrackedEventsService
  ) {}

  /**
   * Given a list of serviceTitleIds, retrieve those titles from
   * RetroAchievements as well as their achievements and store them
   * as Game and GameAchievement entities in our DB.
   */
  async addRetroachievementsTitlesToDb(targetServiceTitleIds: string[]) {
    const addedGames: Game[] = [];

    this.#logger.log(`Need to add ${targetServiceTitleIds.length} RA titles`);

    for (const serviceTitleId of targetServiceTitleIds) {
      // We have to make a fetch to load all the game's achievements.
      const completeGameMetadata = await this.#fetchCompleteGameMetadata(
        serviceTitleId
      );

      const addedGame = await this.dbService.addMappedCompleteGame(
        completeGameMetadata
      );

      addedGames.push(addedGame);
    }

    this.#logger.log(`Added ${addedGames.length} RA titles`);

    return addedGames;
  }

  async createRetroachievementsUserGameProgress(
    storedGameId: string,
    trackedAccount: TrackedAccount,
    serviceTitleId: string
  ) {
    this.#logger.log(
      `Creating UserGameProgress for ${trackedAccount.gamingService}:${trackedAccount.accountUserName}:${storedGameId}`
    );

    // Fetch the user progress from the gaming service itself.
    // This is the list of unlocked achievements as well as when
    // they were unlocked.
    const userEarnedAchievements =
      await this.#fetchUserGameUnlockedAchievements(
        trackedAccount.accountUserName,
        serviceTitleId
      );

    const { newUserGameProgress, isCompletion, scoringThresholdAchievements } =
      await this.dbService.addNewUserGameProgress(
        storedGameId,
        trackedAccount,
        userEarnedAchievements,
        undefined,
        { trackEventOnScoringThreshold: 100 }
      );

    // Report new completions.
    if (isCompletion) {
      await this.trackedEventsService.trackRetroachievementsNewMastery(
        trackedAccount.id,
        storedGameId
      );
    }

    // Report new 100-point unlocks.
    if (scoringThresholdAchievements.length > 0) {
      for (const scoringThresholdAchievement of scoringThresholdAchievements) {
        await this.trackedEventsService.trackRetroachievementsHundredPointUnlocks(
          trackedAccount.id,
          storedGameId,
          scoringThresholdAchievement.serviceAchievementId,
          scoringThresholdAchievement.knownEarnerCount
        );
      }
    }

    this.#logger.log(
      `Created UserGameProgress for ${trackedAccount.gamingService}:${trackedAccount.accountUserName}:${storedGameId} as ${newUserGameProgress.id}`
    );

    return newUserGameProgress;
  }

  async getIsMissingAnyRetroachievementsPoints(
    trackedAccountId: string,
    retroachievementsUserName: string
  ): Promise<{ missingPoints: number }> {
    const { points: totalPoints } = await this.dataService.fetchUserPoints(
      retroachievementsUserName
    );

    const currentStoredPoints =
      await this.dbService.findTrackedAccountPointsSum(trackedAccountId);

    const missingPoints = totalPoints - currentStoredPoints;
    return { missingPoints };
  }

  /**
   * Given a username from RetroAchievements, fetch that user's list of games.
   * Then, determine which of those games we have stored and which ones we don't.
   * Return both lists of serviceTitleIds.
   */
  async getMissingAndPresentUserRetroachievementsGames(
    retroachievementsUserName: string,
    /**
     * Oftentimes we'll only do a partial sync to save bandwidth.
     * This issue emerges on huge accounts, where consistently pulling
     * their entire game list is extremely network intensive.
     */
    options: { isFullSync: boolean }
  ) {
    // First, fetch the list of all the user games. From this, we'll
    // have all the title IDs so we can check our database for what
    // games we have and what games we're missing.
    const allUserGames = await this.#fetchUserSyncGames(
      retroachievementsUserName,
      options.isFullSync
    );

    const allUserServiceTitleIds = allUserGames.map(
      (userGame) => userGame.serviceTitleId
    );

    const {
      existingGameServiceTitleIds,
      missingGameServiceTitleIds,
      staleGameServiceTitleIds
    } = await this.dbService.getMultipleGamesExistenceStatus(
      "RA",
      allUserServiceTitleIds
    );

    this.#logger.log(
      `${retroachievementsUserName} has ${allUserGames.length} games tracked on RA. ${existingGameServiceTitleIds.length} of ${allUserGames.length} are stored in our DB.`
    );

    return {
      allUserGames,
      existingGameServiceTitleIds,
      missingGameServiceTitleIds,
      staleGameServiceTitleIds
    };
  }

  async updateRetroachievementsTitlesInDb(targetServiceTitleIds: string[]) {
    const updatedGames: Pick<Game, "id" | "name" | "serviceTitleId">[] = [];

    this.#logger.log(
      `Need to update ${targetServiceTitleIds.length} RA titles`
    );

    for (const serviceTitleId of targetServiceTitleIds) {
      try {
        // We have to make a fetch to load all the game's achievements.
        const completeGameMetadata = await this.#fetchCompleteGameMetadata(
          serviceTitleId
        );

        const updatedGame = await this.dbService.updateMappedCompleteGame(
          completeGameMetadata
        );

        updatedGames.push(updatedGame);
      } catch (error) {
        this.#logger.error(`Could not fetch RA game ${serviceTitleId}`, error);
      }
    }

    return updatedGames;
  }

  async updateRetroachievementsUserGameProgress(
    existingUserGameProgress: Pick<
      UserGameProgress,
      "id" | "gameId" | "trackedAccountId"
    >,
    storedGameId: string,
    trackedAccount: TrackedAccount,
    serviceTitleId: string
  ) {
    this.#logger.log(
      `Updating UserGameProgress for ${trackedAccount.gamingService}:${trackedAccount.accountUserName}:${storedGameId}`
    );

    // First, fetch the user progress from the gaming service itself.
    // This is the list of unlocked achievements as well as when
    // they were unlocked.
    const earnedGameAchievements =
      await this.#fetchUserGameUnlockedAchievements(
        trackedAccount.accountUserName,
        serviceTitleId
      );

    // TODO: This would be a good place to update the stored achievements
    // for the game. It's likely they're stale, and we're already doing
    // work on them anyway. So instead of a find, this should be an upsert.

    const { isCompletion, scoringThresholdAchievements } =
      await this.dbService.updateExistingUserGameProgress(
        existingUserGameProgress,
        earnedGameAchievements,
        { trackEventOnScoringThreshold: 100 }
      );

    // Report new masteries.
    if (isCompletion) {
      await this.trackedEventsService.trackRetroachievementsNewMastery(
        trackedAccount.id,
        storedGameId
      );
    }

    // Report new 100-point unlocks.
    if (scoringThresholdAchievements.length > 0) {
      for (const scoringThresholdAchievement of scoringThresholdAchievements) {
        await this.trackedEventsService.trackRetroachievementsHundredPointUnlocks(
          trackedAccount.id,
          storedGameId,
          scoringThresholdAchievement.serviceAchievementId,
          scoringThresholdAchievement.knownEarnerCount
        );
      }
    }

    this.#logger.log(
      `Updated UserGameProgress for ${trackedAccount.gamingService}:${trackedAccount.accountUserName}:${storedGameId}`
    );
  }

  async #fetchCompleteGameMetadata(
    serviceTitleId: number | string
  ): Promise<MappedCompleteGame> {
    const gameInfoExtended = await this.dataService.fetchDeepGameInfo(
      serviceTitleId
    );

    return mapGameInfoExtendedToCompleteGame(gameInfoExtended);
  }

  async #fetchUserSyncGames(
    targetUserName: string,
    isRequestingFullSync: boolean
  ): Promise<MappedGame[]> {
    // If the user has no stored progress whatsoever, we'll always
    // fall back to trying to do a full sync for that user. This is
    // because a partial sync will no doubt miss some progress.
    const storedProgressCount =
      await this.dbService.getGameProgressEntitiesCount(targetUserName, "RA");

    if (storedProgressCount === 0) {
      this.#logger.verbose(
        `Falling back to doing a full sync for RA user ${targetUserName}. No current stored progress.`
      );
    }

    const mustDoFullSync = storedProgressCount === 0 || isRequestingFullSync;

    let allUserGames: MappedGame[] = [];
    if (mustDoFullSync) {
      allUserGames = await this.#fetchAllUserPlayedGames(targetUserName);
    } else {
      allUserGames = await this.#fetchRecentUserPlayedGames(targetUserName);
    }

    return allUserGames;
  }

  async #fetchAllUserPlayedGames(
    targetUserName: string
  ): Promise<MappedGame[]> {
    const allUserPlayedGames = await this.dataService.fetchAllUserGames(
      targetUserName
    );

    return allUserPlayedGames.map(mapUserGameCompletionToStoredGame);
  }

  async #fetchRecentUserPlayedGames(
    targetUserName: string
  ): Promise<MappedGame[]> {
    const allUserRecentGames = await this.dataService.fetchRecentUserGames(
      targetUserName
    );

    // Ignore any games that the user may have started but
    // didn't actually do anything in the game with.
    const onlyWithSomeProgress = allUserRecentGames.filter(
      (recentGame) => recentGame.numAchievedHardcore > 0
    );

    return onlyWithSomeProgress.map(
      mapUserRecentlyPlayedGameEntityToMappedGame
    );
  }

  async #fetchUserGameUnlockedAchievements(
    targetUserName: string,
    serviceTitleId: number | string
  ): Promise<MappedGameAchievement[]> {
    const gameInfoAndUserProgress =
      await this.dataService.fetchUserGameProgress(
        targetUserName,
        serviceTitleId
      );

    const earnedGameAchievements = gameInfoAndUserProgress.achievements.filter(
      (achievement) => !!achievement.dateEarnedHardcore
    );

    return earnedGameAchievements.map(mapAchievementToMappedGameAchievement);
  }
}
