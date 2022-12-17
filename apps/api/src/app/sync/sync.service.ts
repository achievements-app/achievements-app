import { InjectQueue } from "@nestjs/bull";
import { Injectable } from "@nestjs/common";
import { Game, TrackedAccount, UserGameProgress } from "@prisma/client";
import { Queue } from "bull";
import { UserGameCompletion } from "retroachievements-js";

import { DbService } from "@/api/db/db.service";
import { RetroachievementsDataService } from "@/api/integrations/retroachievements/retroachievements-data.service";
import { Logger } from "@/api/shared/logger/logger.service";

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
    for (const serviceTitleId of serviceTitleIds) {
      const targetStoredGame = await this.dbService.findExistingGame(
        "RA",
        serviceTitleId
      );

      const targetUserGame = userGames.find(
        (userGame) => userGame.gameId === Number(serviceTitleId)
      );

      const payload: SyncUserGameProgressPayload = {
        trackedAccount,
        serviceTitleId,
        storedGameId: targetStoredGame.id,
        serviceReportedEarnedAchievementCount: targetUserGame.numAwarded
      };

      this.syncQueue.add(
        syncJobNames.syncRetroachievementsUserGameProgress,
        payload
      );
    }
  }
}
