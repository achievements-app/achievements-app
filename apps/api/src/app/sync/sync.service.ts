import { InjectQueue } from "@nestjs/bull";
import { Injectable } from "@nestjs/common";
import type { Queue } from "bull";

import type { MappedGame } from "@achievements-app/data-access-common-models";
import type {
  Game,
  TrackedAccount,
  UserGameProgress
} from "@achievements-app/data-access-db";

import { DbService } from "@/api/shared/db/db.service";
import { RetroachievementsService } from "@/api/shared/integrations/retroachievements/retroachievements.service";
import { XboxService } from "@/api/shared/integrations/xbox/xbox.service";
import { XboxDataService } from "@/api/shared/integrations/xbox/xbox-data.service";
import { Logger } from "@/api/shared/logger/logger.service";

import { SyncQueuePayload, SyncUserGameProgressPayload } from "./models";
import { syncJobNames } from "./sync-job-names";

@Injectable()
export class SyncService {
  #logger = new Logger(SyncService.name);

  constructor(
    @InjectQueue("sync") private readonly syncQueue: Queue<SyncQueuePayload>,
    private readonly retroachievementsService: RetroachievementsService,
    private readonly xboxDataService: XboxDataService,
    private readonly xboxService: XboxService,
    private readonly dbService: DbService
  ) {}

  /**
   * Given a set of UserGameCompletion entities retrieved from the
   * RetroAchievements API, fetch the list of achievements for the
   * game and then store the game and its achievements in our DB.
   */
  async addRetroachievementsTitlesToDb(targetServiceTitleIds: string[]) {
    const addedGames: Game[] = [];

    this.#logger.log(`Need to add ${targetServiceTitleIds.length} RA titles`);

    for (const serviceTitleId of targetServiceTitleIds) {
      // We have to make a fetch to load all the game's achievements.
      const completeGameMetadata =
        await this.retroachievementsService.fetchCompleteGameMetadata(
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
        const completeGameMetadata =
          await this.xboxService.fetchCompleteGameMetadata(
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

  async updateRetroachievementsTitlesInDb(targetServiceTitleIds: string[]) {
    const updatedGames: Game[] = [];

    this.#logger.log(
      `Need to update ${targetServiceTitleIds.length} RA titles`
    );

    for (const serviceTitleId of targetServiceTitleIds) {
      try {
        // We have to make a fetch to load all the game's achievements.
        const completeGameMetadata =
          await this.retroachievementsService.fetchCompleteGameMetadata(
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
        const completeGameMetadata =
          await this.xboxService.fetchCompleteGameMetadata(
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
      await this.retroachievementsService.fetchUserGameUnlockedAchievements(
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
    const serviceUserGameProgress =
      await this.xboxService.fetchCompleteGameMetadata(
        trackedAccount.xboxXuid,
        storedGame.serviceTitleId,
        storedGame.xboxAchievementsSchemaKind as "legacy" | "modern"
      );

    const newUserGameProgress = await this.dbService.addNewUserGameProgress(
      storedGame.id,
      trackedAccount,
      serviceUserGameProgress.achievements
    );

    this.#logger.log(
      `Created UserGameProgress for ${trackedAccount.gamingService}:${trackedAccount.accountUserName}:${storedGame.id} as ${newUserGameProgress.id}`
    );

    return newUserGameProgress;
  }

  async updateRetroachievementsUserGameProgress(
    existingUserGameProgress: UserGameProgress,
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
      await this.retroachievementsService.fetchUserGameUnlockedAchievements(
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
    const serviceUserGameProgress =
      await this.xboxService.fetchCompleteGameMetadata(
        trackedAccount.xboxXuid,
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
    const allUserGames =
      await this.retroachievementsService.fetchUserPlayedGames(
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

  async getMissingAndPresentUserXboxGames(userXuid: string, gamertag: string) {
    // First, fetch the list of all the user games. From this, we'll
    // have all the title IDs so we can check our database for what
    // games we have and what games we're missing.
    const allUserGames = await this.xboxService.fetchUserPlayedGames(userXuid);

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

  /**
   * Nearly every Xbox API call requires an XUID. We'll have this value
   * stored every time except the first sync. If we're running the first
   * sync for the account, we'll need to make a call to fetch the XUID.
   */
  async useTrackedAccountXuid(trackedAccount: TrackedAccount): Promise<string> {
    if (trackedAccount.xboxXuid) {
      return trackedAccount.xboxXuid;
    }

    // If we don't already have the account's XUID, retrieve it
    // from Xbox and store it in the database. Note that we treat
    // accountUserName as the gamertag.
    const xuid = await this.xboxDataService.fetchXuidFromGamertag(
      trackedAccount.accountUserName
    );
    await this.dbService.storeTrackedAccountXuid(trackedAccount, xuid);

    return xuid;
  }

  async queueSyncUserProgressJobsForRetroachievementsGames(
    serviceTitleIds: string[],
    userGames: MappedGame[],
    trackedAccount: TrackedAccount
  ) {
    // We first want to get the list of all titles needing a progress sync.
    const allTargetStoredGames = await this.dbService.db.game.findMany({
      where: {
        gamingService: "RA",
        serviceTitleId: { in: serviceTitleIds }
      }
    });

    const allServiceTitleIdsNeedingSync =
      await this.getAllRetroachievementsGamesRequiringProgressSync(
        trackedAccount,
        allTargetStoredGames,
        userGames
      );

    // For each title needing a progress sync, build a job payload and
    // queue the progress sync job.
    for (const serviceTitleIdNeedingSync of allServiceTitleIdsNeedingSync) {
      const storedGame = allTargetStoredGames.find(
        (game) => game.serviceTitleId === serviceTitleIdNeedingSync
      );

      const targetUserGame = userGames.find(
        (userGame) => userGame.serviceTitleId === serviceTitleIdNeedingSync
      );

      const payload: SyncUserGameProgressPayload = {
        trackedAccount,
        serviceTitleId: serviceTitleIdNeedingSync,
        storedGameId: storedGame.id,
        serviceReportedEarnedAchievementCount:
          targetUserGame.knownUserEarnedAchievementCount ?? 0
      };

      this.syncQueue.add(
        syncJobNames.syncRetroachievementsUserGameProgress,
        payload,
        { attempts: 5, backoff: 60000 }
      );
    }
  }

  async queueSyncUserProgressJobsForXboxGames(
    serviceTitleIds: string[],
    userGames: MappedGame[],
    trackedAccount: TrackedAccount
  ) {
    // We first want to get the list of all titles needing a progress sync.
    const allTargetStoredGames = await this.dbService.db.game.findMany({
      where: {
        gamingService: "XBOX",
        serviceTitleId: { in: serviceTitleIds }
      }
    });

    // Some really old mobile games might still be on the user's account
    // but we cannot actually fetch the progress for these titles anymore.
    // "Wordament" is a good example. Filter these games out.
    const withoutMissingUserGames = userGames.filter(
      (userGame) =>
        !!allTargetStoredGames.find(
          (targetStoredGame) =>
            targetStoredGame.serviceTitleId === userGame.serviceTitleId
        )
    );

    const allServiceTitleIdsNeedingSync =
      await this.getAllXboxGamesRequiringProgressSync(
        trackedAccount,
        allTargetStoredGames,
        withoutMissingUserGames
      );

    // For each title needing a progress sync, build a job payload and
    // queue the progress sync job.
    for (const serviceTitleIdNeedingSync of allServiceTitleIdsNeedingSync) {
      const storedGame = allTargetStoredGames.find(
        (game) => game.serviceTitleId === serviceTitleIdNeedingSync
      );

      const targetUserGame = userGames.find(
        (userGame) => userGame.serviceTitleId === serviceTitleIdNeedingSync
      );

      const payload: SyncUserGameProgressPayload = {
        trackedAccount,
        serviceTitleId: serviceTitleIdNeedingSync,
        storedGameId: storedGame.id,
        serviceReportedEarnedGamerscore:
          targetUserGame.knownUserEarnedPointsCount
      };

      this.syncQueue.add(syncJobNames.syncXboxUserGameProgress, payload, {
        attempts: 5,
        backoff: 10000
      });
    }
  }

  private async getAllRetroachievementsGamesRequiringProgressSync(
    trackedAccount: TrackedAccount,
    storedGames: Game[],
    serviceUserGames: MappedGame[]
  ) {
    const allAccountUserGameProgresses =
      await this.dbService.findAllTrackedAccountUserGameProgressByGameIds(
        trackedAccount.id,
        storedGames.map((game) => game.id)
      );

    const serviceTitleIdsNeedingSync: string[] = [];

    for (const serviceUserGame of serviceUserGames) {
      // Work is needed if:
      // (a) There is no UserGameProgress entity for the game, or
      // (b) The number of achievements earned reported by RA does not
      // match the number of achievements earned we've stored internally.

      const foundUserGameProgress = allAccountUserGameProgresses.find(
        (userGameProgress) =>
          userGameProgress.game.serviceTitleId ===
          serviceUserGame.serviceTitleId
      );

      const doAchievementCountsMatch = foundUserGameProgress
        ? foundUserGameProgress.earnedAchievements.length ===
          serviceUserGame.knownUserEarnedAchievementCount
        : false;

      const needsSync = !foundUserGameProgress || !doAchievementCountsMatch;
      if (needsSync) {
        this.#logger.log(
          `Work needed for ${trackedAccount.accountUserName}:${serviceUserGame.name}:${serviceUserGame.serviceTitleId}`
        );
        serviceTitleIdsNeedingSync.push(serviceUserGame.serviceTitleId);
      } else {
        this.#logger.verbose(
          `No work needed for ${trackedAccount.accountUserName}:${serviceUserGame.name}:${serviceUserGame.serviceTitleId}`
        );
      }
    }

    return serviceTitleIdsNeedingSync;
  }

  private async getAllXboxGamesRequiringProgressSync(
    trackedAccount: TrackedAccount,
    storedGames: Game[],
    serviceUserGames: MappedGame[]
  ) {
    const allAccountUserGameProgresses =
      await this.dbService.findAllTrackedAccountUserGameProgressByGameIds(
        trackedAccount.id,
        storedGames.map((game) => game.id)
      );

    const serviceTitleIdsNeedingSync: string[] = [];

    for (const serviceUserGame of serviceUserGames) {
      // Work is needed if:
      // (a) There is no UserGameProgress entity for the game, or
      // (b) The current unlocked gamerscore reported by Xbox does not
      // match the unlocked gamerscore we've stored internally.

      const foundUserGameProgress = allAccountUserGameProgresses.find(
        (userGameProgress) =>
          userGameProgress.game.serviceTitleId ===
          serviceUserGame.serviceTitleId
      );

      // Determine the unlocked gamerscore we've stored internally.
      let knownUnlockedGamerscore = 0;
      if (foundUserGameProgress) {
        for (const earnedAchievement of foundUserGameProgress.earnedAchievements) {
          knownUnlockedGamerscore +=
            earnedAchievement.achievement.vanillaPoints;
        }
      }

      const doesGamerscoreMatch =
        serviceUserGame.knownUserEarnedPointsCount === knownUnlockedGamerscore;

      const needsSync = !foundUserGameProgress || !doesGamerscoreMatch;
      if (needsSync) {
        this.#logger.log(
          `Work needed for ${trackedAccount.accountUserName} ${serviceUserGame.name}:${serviceUserGame.serviceTitleId}`
        );
        serviceTitleIdsNeedingSync.push(serviceUserGame.serviceTitleId);
      } else {
        this.#logger.log(
          `No work needed for ${trackedAccount.accountUserName} ${serviceUserGame.name}:${serviceUserGame.serviceTitleId}`
        );
      }
    }

    return serviceTitleIdsNeedingSync;
  }
}
