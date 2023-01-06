import { InjectQueue } from "@nestjs/bull";
import { Injectable } from "@nestjs/common";
import type { Queue } from "bull";

import type { MappedGame } from "@achievements-app/data-access-common-models";
import type { Game, TrackedAccount } from "@achievements-app/data-access-db";

import { DbService } from "@/api/shared/db/db.service";
import { Logger } from "@/api/shared/logger/logger.service";

import {
  SyncPsnGamePayload,
  SyncQueuePayload,
  SyncUserGameProgressPayload
} from "./models";
import { syncJobNames } from "./sync-job-names";

@Injectable()
export class SyncService {
  #logger = new Logger(SyncService.name);

  constructor(
    @InjectQueue("sync") private readonly syncQueue: Queue<SyncQueuePayload>,
    private readonly dbService: DbService
  ) {}

  async queueSyncUserProgressJobsForRetroachievementsGames(
    serviceTitleIds: string[],
    userGames: MappedGame[],
    trackedAccount: TrackedAccount
  ) {
    // We first want to get the list of all titles needing a progress sync.
    const allTargetStoredGames =
      await this.dbService.findMultipleGamesByServiceTitleIds(
        serviceTitleIds,
        "RA"
      );

    const allServiceTitleIdsNeedingSync =
      await this.#getAllRetroachievementsGamesRequiringProgressSync(
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

  async queueSyncJobsForUserMissingPsnGames(
    missingGameServiceTitleIds: string[],
    allUserGames: MappedGame[],
    trackedAccount: TrackedAccount
  ) {
    for (const missingGameServiceTitleId of missingGameServiceTitleIds) {
      const targetUserGame = allUserGames.find(
        (userGame) => userGame.serviceTitleId === missingGameServiceTitleId
      );

      const payload: SyncPsnGamePayload = {
        trackedAccount,
        userGame: targetUserGame
      };

      await this.syncQueue.add(syncJobNames.syncPsnUserMissingGame, payload, {
        attempts: 3,
        backoff: 15000
      });
    }
  }

  async queueSyncUserProgressJobsForPsnGames(
    allServiceTitleIdsNeedingSync: string[],
    allUserGames: MappedGame[],
    trackedAccount: TrackedAccount
  ) {
    for (const serviceTitleIdNeedingSync of allServiceTitleIdsNeedingSync) {
      const targetUserGame = allUserGames.find(
        (userGame) => userGame.serviceTitleId === serviceTitleIdNeedingSync
      );

      const payload: SyncPsnGamePayload = {
        trackedAccount,
        userGame: targetUserGame
      };

      await this.syncQueue.add(syncJobNames.syncPsnUserGameProgress, payload, {
        attempts: 3,
        backoff: 15000
      });
    }
  }

  async queueSyncUserProgressJobsForXboxGames(
    serviceTitleIds: string[],
    userGames: MappedGame[],
    trackedAccount: TrackedAccount
  ) {
    // We first want to get the list of all titles needing a progress sync.
    const allTargetStoredGames =
      await this.dbService.findMultipleGamesByServiceTitleIds(
        serviceTitleIds,
        "XBOX"
      );

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
      await this.#getAllXboxGamesRequiringProgressSync(
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

  async #getAllXboxGamesRequiringProgressSync(
    trackedAccount: TrackedAccount,
    storedGames: Pick<Game, "id" | "serviceTitleId">[],
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
      }
    }

    return serviceTitleIdsNeedingSync;
  }

  async #getAllRetroachievementsGamesRequiringProgressSync(
    trackedAccount: TrackedAccount,
    storedGames: Pick<Game, "id" | "serviceTitleId">[],
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
      }
    }

    return serviceTitleIdsNeedingSync;
  }
}
