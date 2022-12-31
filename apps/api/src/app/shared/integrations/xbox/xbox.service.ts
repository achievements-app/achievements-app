import { Injectable } from "@nestjs/common";

import type {
  MappedCompleteGame,
  MappedGame
} from "@achievements-app/data-access-common-models";
import type {
  Game,
  TrackedAccount,
  UserGameProgress
} from "@achievements-app/data-access-db";

import { DbService } from "@/api/shared/db/db.service";
import { Logger } from "@/api/shared/logger/logger.service";

import { mapTitleHistoryEntityToStoredGame } from "./utils/mapTitleHistoryEntityToStoredGame";
import { mapXboxDeepGameInfoToCompleteGame } from "./utils/mapXboxDeepGameInfoToCompleteGame";
import { XboxDataService } from "./xbox-data.service";

@Injectable()
export class XboxService {
  #logger = new Logger(XboxService.name);

  constructor(
    private readonly dataService: XboxDataService,
    private readonly dbService: DbService
  ) {}

  async addXboxTitlesToDb(
    userXuid: string,
    targetServiceTitleIds: string[],
    allUserGames: MappedGame[]
  ) {
    const addedGames: Game[] = [];

    const targetUserGames = allUserGames.filter((userGame) =>
      targetServiceTitleIds.includes(userGame.serviceTitleId)
    );
    this.#logger.log(`Need to add ${targetUserGames.length} XBOX titles`);

    for (const targetUserGame of targetUserGames) {
      try {
        const completeGameMetadata = await this.#fetchCompleteGameMetadata(
          userXuid,
          targetUserGame.serviceTitleId,
          targetUserGame.xboxAchievementsSchemaKind as "legacy" | "modern"
        );

        const addedGame = await this.dbService.addMappedCompleteGame(
          completeGameMetadata
        );

        addedGames.push(addedGame);

        // TODO: When we fetch these games, Xbox is also returning the progress.
        // We should make sure we don't need to do subsequent fetches for the progress
        // to save the API some effort.
      } catch (error) {
        this.#logger.error(
          `Could not fetch XBOX game ${targetUserGame.name}:${targetUserGame.serviceTitleId}`,
          error
        );
      }
    }

    return addedGames;
  }

  async createXboxUserGameProgress(
    storedGame: Game,
    trackedAccount: TrackedAccount
  ) {
    this.#logger.log(
      `Creating UserGameProgress for ${trackedAccount.gamingService}:${trackedAccount.accountUserName}:${storedGame.id}`
    );

    // Fetch the user progress from the gaming service itself.
    // This is the list of unlocked achievements as well as when
    // they were unlocked.
    const serviceUserGameProgress = await this.#fetchCompleteGameMetadata(
      trackedAccount.serviceAccountId,
      storedGame.serviceTitleId,
      storedGame.xboxAchievementsSchemaKind as "legacy" | "modern"
    );

    const earnedAchievements = serviceUserGameProgress.achievements.filter(
      (achievement) => achievement.earnedOn
    );

    const newUserGameProgress = await this.dbService.addNewUserGameProgress(
      storedGame.id,
      trackedAccount,
      earnedAchievements
    );

    this.#logger.log(
      `Created UserGameProgress for ${trackedAccount.gamingService}:${trackedAccount.accountUserName}:${storedGame.id} as ${newUserGameProgress.id}`
    );

    return newUserGameProgress;
  }

  async getMissingAndPresentUserXboxGames(userXuid: string, gamertag: string) {
    // First, fetch the list of all the user games. From this, we'll
    // have all the title IDs so we can check our database for what
    // games we have and what games we're missing.
    const allUserGames = await this.#fetchUserPlayedGames(userXuid);

    const allUserServiceTitleIds = allUserGames.map(
      (userGame) => userGame.serviceTitleId
    );

    const {
      existingGameServiceTitleIds,
      missingGameServiceTitleIds,
      staleGameServiceTitleIds
    } = await this.dbService.getMultipleGamesExistenceStatus(
      "XBOX",
      allUserServiceTitleIds
    );

    this.#logger.log(
      `${gamertag}:${userXuid} has ${allUserGames.length} games tracked on XBOX. ${existingGameServiceTitleIds.length} of ${allUserGames.length} are stored in our DB.`
    );

    return {
      existingGameServiceTitleIds,
      missingGameServiceTitleIds,
      staleGameServiceTitleIds,
      allUserGames
    };
  }

  async updateXboxTitlesInDb(
    userXuid: string,
    targetServiceTitleIds: string[],
    allUserGames: MappedGame[]
  ) {
    const updatedGames: Game[] = [];

    const targetUserGames = allUserGames.filter((userGame) =>
      targetServiceTitleIds.includes(userGame.serviceTitleId)
    );
    this.#logger.log(`Need to update ${targetUserGames.length} XBOX titles`);

    for (const targetUserGame of targetUserGames) {
      try {
        const completeGameMetadata = await this.#fetchCompleteGameMetadata(
          userXuid,
          targetUserGame.serviceTitleId,
          targetUserGame.xboxAchievementsSchemaKind as "legacy" | "modern"
        );

        const updatedGame = await this.dbService.updateMappedCompleteGame(
          completeGameMetadata
        );

        updatedGames.push(updatedGame);
      } catch (error) {
        this.#logger.error(
          `Could not fetch XBOX game ${targetUserGame.name}:${targetUserGame.serviceTitleId}`,
          error
        );
      }
    }

    return updatedGames;
  }

  async updateXboxUserGameProgress(
    existingUserGameProgress: UserGameProgress,
    storedGame: Game,
    trackedAccount: TrackedAccount
  ) {
    this.#logger.log(
      `Updating UserGameProgress for ${trackedAccount.gamingService}:${trackedAccount.accountUserName}:${storedGame.id}`
    );

    // First, fetch the user progress from the gaming service itself.
    // This is the list of unlocked achievements as well as when
    // they were unlocked.
    const serviceUserGameProgress = await this.#fetchCompleteGameMetadata(
      trackedAccount.serviceAccountId,
      storedGame.serviceTitleId,
      storedGame.xboxAchievementsSchemaKind as "legacy" | "modern"
    );

    const allGameAchievements =
      await this.dbService.findAllStoredGameAchievements(storedGame.id);

    const earnedGameAchievements = serviceUserGameProgress.achievements.filter(
      (achievement) => !!achievement.earnedOn
    );

    // Does the game have any missing achievements?
    const allGameAchievementServiceIds = allGameAchievements.map(
      (gameAchievement) => gameAchievement.serviceAchievementId
    );
    const hasMissingAchievements = earnedGameAchievements.some(
      (earnedGameAchievement) =>
        !allGameAchievementServiceIds.includes(
          earnedGameAchievement.serviceAchievementId
        )
    );

    // If there are missing achievements, we need to mark the game as stale.
    // This will force a subsequent update of the game and its achievements.
    if (hasMissingAchievements) {
      this.#logger.log(
        `Marking XBOX:${storedGame.name}:${storedGame.id} as stale`
      );
      await this.dbService.markGameAsStale(storedGame.id);

      // FIXME: Update the game before continuing on. Without an update
      // to the game, `updateExistingUserGameProgress()` will fail.
    }

    await this.dbService.updateExistingUserGameProgress(
      existingUserGameProgress,
      earnedGameAchievements
    );
  }

  /**
   * Nearly every Xbox API call requires an XUID. We'll have this value
   * stored every time except the first sync. If we're running the first
   * sync for the account, we'll need to make a call to fetch the XUID.
   */
  async useTrackedAccountXuid(
    trackedAccount: TrackedAccount
  ): Promise<TrackedAccount> {
    if (trackedAccount.serviceAccountId) {
      return trackedAccount;
    }

    // If we don't already have the account's XUID, retrieve it
    // from Xbox and store it in the database. Note that we treat
    // accountUserName as the gamertag.
    const xuid = await this.dataService.fetchXuidFromGamertag(
      trackedAccount.accountUserName
    );
    return await this.dbService.storeTrackedAccountUniqueAccountId(
      trackedAccount,
      xuid
    );
  }

  async #fetchCompleteGameMetadata(
    userXuid: string,
    serviceTitleId: string,
    schemaKind: "legacy" | "modern"
  ): Promise<MappedCompleteGame> {
    const xboxDeepGameInfo = await this.dataService.fetchDeepGameInfo(
      userXuid,
      serviceTitleId,
      schemaKind
    );

    return mapXboxDeepGameInfoToCompleteGame(xboxDeepGameInfo, schemaKind);
  }

  async #fetchUserPlayedGames(userXuid: string): Promise<MappedGame[]> {
    const allUserPlayedGames =
      await this.dataService.fetchCompleteTitleHistoryByXuid(userXuid);

    return allUserPlayedGames
      .map(mapTitleHistoryEntityToStoredGame)
      .filter((game) => game.knownUserEarnedPointsCount > 0);
  }
}
