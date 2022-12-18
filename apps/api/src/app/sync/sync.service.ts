import { InjectQueue } from "@nestjs/bull";
import { Injectable } from "@nestjs/common";
import { Game, TrackedAccount, UserGameProgress } from "@prisma/client";
import { Queue } from "bull";
import { UserGameCompletion } from "retroachievements-js";

import { DbService } from "../db/db.service";
import { RetroachievementsDataService } from "../integrations/retroachievements/retroachievements-data.service";
import { Logger } from "../shared/logger/logger.service";
import { SyncQueuePayload, SyncUserGameProgressPayload } from "./models";
import { syncJobNames } from "./sync-job-names";

@Injectable()
export class SyncService {
  #logger = new Logger(SyncService.name);

  constructor(
    @InjectQueue("sync") private readonly syncQueue: Queue<SyncQueuePayload>,
    private readonly retroachievementsDataService: RetroachievementsDataService,
    private readonly dbService: DbService
  ) {}

  async addRetroachievementsTitlesToDb(
    targetServiceTitleIds: string[],
    allUserGames: UserGameCompletion[]
  ) {
    const upsertedGames: Game[] = [];

    for (const serviceTitleId of targetServiceTitleIds) {
      // We have to make a fetch to load all the game's achievements.
      const { achievements } =
        await this.retroachievementsDataService.fetchDeepGameInfo(
          serviceTitleId
        );

      const targetGame = allUserGames.find(
        (userGame) => userGame.gameId === Number(serviceTitleId)
      );

      const upsertedGame = await this.dbService.upsertRetroachievementsGame(
        targetGame,
        achievements
      );

      upsertedGames.push(upsertedGame);
    }

    this.#logger.log(`Upserted ${upsertedGames.length} RA titles`);

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

  async queueSyncUserProgressJobsForRetroachievementsGames(
    serviceTitleIds: string[],
    userGames: UserGameCompletion[],
    trackedAccount: TrackedAccount
  ) {
    const allTargetStoredGames = await this.dbService.game.findMany({
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
      await this.dbService.userGameProgress.findMany({
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
