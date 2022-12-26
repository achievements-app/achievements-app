import { InjectQueue } from "@nestjs/bull";
import { Injectable } from "@nestjs/common";
import { Game, TrackedAccount, UserGameProgress } from "@prisma/client";
import { Queue } from "bull";
import { UserGameCompletion } from "retroachievements-js";

import { DbService } from "@/api/shared/db/db.service";
import { RetroachievementsDataService } from "@/api/shared/integrations/retroachievements/retroachievements-data.service";
import { XboxDataService } from "@/api/shared/integrations/xbox/xbox-data.service";
import { Logger } from "@/api/shared/logger/logger.service";

import { XboxSanitizedTitleHistoryEntity } from "../shared/integrations/xbox/models";
import { SyncQueuePayload, SyncUserGameProgressPayload } from "./models";
import { syncJobNames } from "./sync-job-names";

@Injectable()
export class SyncService {
  #logger = new Logger(SyncService.name);

  constructor(
    @InjectQueue("sync") private readonly syncQueue: Queue<SyncQueuePayload>,
    private readonly retroachievementsDataService: RetroachievementsDataService,
    private readonly xboxDataService: XboxDataService,
    private readonly dbService: DbService
  ) {}

  /**
   * Given a set of UserGameCompletion entities retrieved from the
   * RetroAchievements API, fetch the list of achievements for the
   * game and then store the game and its achievements in our DB.
   */
  async addRetroachievementsTitlesToDb(
    targetServiceTitleIds: string[],
    allUserGames: UserGameCompletion[]
  ) {
    const upsertedGames: Game[] = [];

    this.#logger.log(
      `Need to upsert ${targetServiceTitleIds.length} RA titles`
    );

    for (const serviceTitleId of targetServiceTitleIds) {
      // We have to make a fetch to load all the game's achievements.
      const { achievements, numDistinctPlayersHardcore } =
        await this.retroachievementsDataService.fetchDeepGameInfo(
          serviceTitleId
        );

      const targetGame = allUserGames.find(
        (userGame) => userGame.gameId === Number(serviceTitleId)
      );

      const upsertedGame = await this.dbService.upsertRetroachievementsGame(
        targetGame,
        achievements,
        numDistinctPlayersHardcore
      );

      upsertedGames.push(upsertedGame);
    }

    this.#logger.log(`Upserted ${upsertedGames.length} RA titles`);

    return upsertedGames;
  }

  async addXboxTitlesToDb(
    userXuid: string,
    targetServiceTitleIds: string[],
    allUserGames: XboxSanitizedTitleHistoryEntity[]
  ) {
    const upsertedGames: Game[] = [];

    const targetUserGames = allUserGames.filter((userGame) =>
      targetServiceTitleIds.includes(String(userGame.titleId))
    );
    this.#logger.log(`Need to upsert ${targetUserGames.length} XBOX titles`);

    for (const targetUserGame of targetUserGames) {
      try {
        const deepGameInfo = await this.xboxDataService.fetchDeepGameInfo(
          userXuid,
          targetUserGame
        );

        const upsertedGame = await this.dbService.upsertXboxGame(deepGameInfo);

        upsertedGames.push(upsertedGame);

        // TODO: When we fetch these games, Xbox is also returning the progress.
        // We should make sure we don't need to do subsequent fetches for the progress
        // to save the API some effort.
      } catch (error) {
        this.#logger.error(
          `Could not fetch XBOX game ${targetUserGame.name}:${targetUserGame.titleId}`,
          error
        );
      }
    }

    return upsertedGames;
  }

  async createRetroachievementsUserGameProgress(
    storedGameId: string,
    trackedAccount: TrackedAccount,
    serviceTitleId: string
  ) {
    this.#logger.log(
      `Creating UserGameProgress for ${trackedAccount.gamingService} ${trackedAccount.accountUserName} ${storedGameId}`
    );

    // First, fetch the user progress from the gaming service itself.
    // This is the list of unlocked achievements as well as when
    // they were unlocked.
    const serviceUserGameProgress =
      await this.retroachievementsDataService.fetchUserGameProgress(
        trackedAccount.accountUserName,
        serviceTitleId
      );

    const newUserGameProgress =
      await this.dbService.addNewRetroachievementsUserGameProgress(
        storedGameId,
        trackedAccount,
        serviceUserGameProgress
      );

    this.#logger.log(
      `Upsert UserGameProgress for ${trackedAccount.gamingService} ${trackedAccount.accountUserName} ${storedGameId}: ${newUserGameProgress.id}`
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
      `Updating UserGameProgress for ${trackedAccount.gamingService} ${trackedAccount.accountUserName} ${storedGameId}`
    );

    // First, fetch the user progress from the gaming service itself.
    // This is the list of unlocked achievements as well as when
    // they were unlocked.
    const serviceUserGameProgress =
      await this.retroachievementsDataService.fetchUserGameProgress(
        trackedAccount.accountUserName,
        serviceTitleId
      );

    // TODO: This would be a good place to update the stored achievements
    // for the game. It's likely they're stale, and we're already doing
    // work on them anyway. So instead of a find, this should be an upsert.
    const allGameAchievements =
      await this.dbService.findAllStoredGameAchievements(storedGameId);

    const earnedGameAchievements = serviceUserGameProgress.achievements.filter(
      (achievement) => !!achievement.dateEarnedHardcore
    );

    await this.dbService.updateExistingRetroachievementsUserGameProgress(
      existingUserGameProgress,
      earnedGameAchievements,
      allGameAchievements
    );

    this.#logger.log(
      `Updated UserGameProgress for ${trackedAccount.gamingService} ${trackedAccount.accountUserName} ${storedGameId}`
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
      await this.retroachievementsDataService.fetchAllUserGames(
        retroachievementsUserName
      );

    const allUserServiceTitleIds = allUserGames.map((userGame) =>
      String(userGame.gameId)
    );

    const { existingGameServiceTitleIds, missingGameServiceTitleIds } =
      await this.dbService.getMultipleGamesExistenceStatus(
        "RA",
        allUserServiceTitleIds
      );

    this.#logger.log(
      `${retroachievementsUserName} has ${allUserGames.length} games tracked on RA. ${existingGameServiceTitleIds.length} of ${allUserGames.length} are stored in our DB.`
    );

    return {
      allUserGames,
      existingGameServiceTitleIds,
      missingGameServiceTitleIds
    };
  }

  async getMissingAndPresentUserXboxGames(userXuid: string, gamertag: string) {
    // First, fetch the list of all the user games. From this, we'll
    // have all the title IDs so we can check our database for what
    // games we have and what games we're missing.
    const allUserGames =
      await this.xboxDataService.fetchCompleteTitleHistoryByXuid(userXuid);

    const onlyGamesWithUserProgress = allUserGames.filter(
      (userGame) => userGame.totalUnlockedGamerscore > 0
    );

    const allUserServiceTitleIds = onlyGamesWithUserProgress.map((userGame) =>
      String(userGame.titleId)
    );

    const { existingGameServiceTitleIds, missingGameServiceTitleIds } =
      await this.dbService.getMultipleGamesExistenceStatus(
        "XBOX",
        allUserServiceTitleIds
      );

    this.#logger.log(
      `${gamertag}:${userXuid} has ${onlyGamesWithUserProgress.length} games tracked on XBOX. ${existingGameServiceTitleIds.length} of ${onlyGamesWithUserProgress.length} are stored in our DB.`
    );

    return {
      existingGameServiceTitleIds,
      missingGameServiceTitleIds,
      allUserGames: onlyGamesWithUserProgress
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
    userGames: UserGameCompletion[],
    trackedAccount: TrackedAccount
  ) {
    const allTargetStoredGames = await this.dbService.db.game.findMany({
      where: {
        gamingService: "RA",
        serviceTitleId: {
          in: serviceTitleIds
        }
      }
    });

    const allServiceTitleIdsNeedingSync =
      await this.getAllRetroachievementsGamesRequiringProgressSync(
        trackedAccount,
        allTargetStoredGames,
        userGames
      );

    for (const serviceTitleIdNeedingSync of allServiceTitleIdsNeedingSync) {
      const storedGame = allTargetStoredGames.find(
        (game) => game.serviceTitleId === serviceTitleIdNeedingSync
      );

      const targetUserGame = userGames.find(
        (userGame) => userGame.gameId === Number(serviceTitleIdNeedingSync)
      );

      const payload: SyncUserGameProgressPayload = {
        trackedAccount,
        serviceTitleId: serviceTitleIdNeedingSync,
        storedGameId: storedGame.id,
        serviceReportedEarnedAchievementCount: targetUserGame.numAwarded
      };

      this.syncQueue.add(
        syncJobNames.syncRetroachievementsUserGameProgress,
        payload,
        { attempts: 5, backoff: 60000 }
      );
    }
  }

  private async getAllRetroachievementsGamesRequiringProgressSync(
    trackedAccount: TrackedAccount,
    storedGames: Game[],
    serviceUserGames: UserGameCompletion[]
  ) {
    const allAccountUserGameProgresses =
      await this.dbService.db.userGameProgress.findMany({
        where: {
          trackedAccountId: trackedAccount.id,
          gameId: {
            in: storedGames.map((game) => game.id)
          }
        },
        include: {
          game: true,
          earnedAchievements: true
        }
      });

    const serviceTitleIdsNeedingSync: string[] = [];

    for (const serviceUserGame of serviceUserGames) {
      // Work is needed if:
      // (a) There is no UserGameProgress entity for the game, or
      // (b) The number of achievements earned reported by RA does not
      // match the number of achievements earned we've stored internally.

      const foundUserGameProgress = allAccountUserGameProgresses.find(
        (userGameProgress) =>
          userGameProgress.game.serviceTitleId ===
          String(serviceUserGame.gameId)
      );

      const doAchievementCountsMatch = foundUserGameProgress
        ? foundUserGameProgress.earnedAchievements.length ===
          serviceUserGame.numAwarded
        : false;

      const needsSync = !foundUserGameProgress || !doAchievementCountsMatch;
      if (needsSync) {
        this.#logger.log(
          `Work needed for ${trackedAccount.accountUserName} ${serviceUserGame.gameId}`
        );
        serviceTitleIdsNeedingSync.push(String(serviceUserGame.gameId));
      } else {
        this.#logger.verbose(
          `No work needed for ${trackedAccount.accountUserName} ${serviceUserGame.gameId}`
        );
      }
    }

    return serviceTitleIdsNeedingSync;
  }
}
