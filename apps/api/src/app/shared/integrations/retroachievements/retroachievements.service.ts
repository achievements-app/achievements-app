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

import { RetroachievementsDataService } from "./retroachievements-data.service";
import { mapAchievementToMappedGameAchievement } from "./utils/mapAchievementToMappedGameAchievement";
import { mapGameInfoExtendedToCompleteGame } from "./utils/mapGameInfoExtendedToCompleteGame";
import { mapUserGameCompletionToStoredGame } from "./utils/mapUserGameCompletionToStoredGame";

@Injectable()
export class RetroachievementsService {
  #logger = new Logger(RetroachievementsService.name);

  constructor(
    private readonly dataService: RetroachievementsDataService,
    private readonly dbService: DbService
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

    const newUserGameProgress = await this.dbService.addNewUserGameProgress(
      storedGameId,
      trackedAccount,
      userEarnedAchievements
    );

    this.#logger.log(
      `Created UserGameProgress for ${trackedAccount.gamingService}:${trackedAccount.accountUserName}:${storedGameId} as ${newUserGameProgress.id}`
    );

    return newUserGameProgress;
  }

  /**
   * Given a username from RetroAchievements, fetch that user's list of games.
   * Then, determine which of those games we have stored and which ones we don't.
   * Return both lists of serviceTitleIds.
   */
  async getMissingAndPresentUserRetroachievementsGames(
    retroachievementsUserName: string
  ) {
    // First, fetch the list of all the user games. From this, we'll
    // have all the title IDs so we can check our database for what
    // games we have and what games we're missing.
    const allUserGames = await this.#fetchUserPlayedGames(
      retroachievementsUserName
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

    await this.dbService.updateExistingUserGameProgress(
      existingUserGameProgress,
      earnedGameAchievements
    );

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

  async #fetchUserPlayedGames(targetUserName: string): Promise<MappedGame[]> {
    const allUserPlayedGames = await this.dataService.fetchAllUserGames(
      targetUserName
    );

    return allUserPlayedGames.map(mapUserGameCompletionToStoredGame);
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
