import {
  OnQueueActive,
  OnQueueCompleted,
  OnQueueError,
  OnQueueFailed,
  OnQueueStalled,
  Process,
  Processor
} from "@nestjs/bull";
import { type Job } from "bull";

import { DbService } from "@/api/shared/db/db.service";
import { Logger } from "@/api/shared/logger/logger.service";

import { SyncUserGameProgressPayload, SyncUserGamesPayload } from "./models";
import { SyncService } from "./sync.service";
import { syncJobNames } from "./sync-job-names";

@Processor("sync")
export class SyncProcessor {
  #logger = new Logger(SyncProcessor.name);

  constructor(
    private readonly syncService: SyncService,
    private readonly dbService: DbService
  ) {}

  @OnQueueStalled()
  onStalled(job: Job) {
    this.#logger.warn(`JOB STALLED ${job.id}`);
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.#logger.logActiveJob(job.name, job.id, job.data);
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    this.#logger.logCompletedJob(job.name, job.id, job.data);
  }

  @OnQueueError()
  onError(error: Error) {
    this.#logger.logErrorJob(error);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.#logger.logFailedJob(job.name, job.id, job.data, error);
  }

  @Process({
    name: syncJobNames.syncRetroachievementsUserGames,
    concurrency: 1
  })
  async processSyncRetroachievementsUserGames(job: Job<SyncUserGamesPayload>) {
    // Get all the user games recorded on RA, as well as what games we
    // do and don't currently have stored in our database. Games that we
    // don't have stored, we'll need to fetch and store before we can store
    // the user's actual progress on the game.
    const {
      allUserGames,
      existingGameServiceTitleIds,
      missingGameServiceTitleIds,
      staleGameServiceTitleIds
    } = await this.syncService.getMissingAndPresentUserRetroachievementsGames(
      job.data.trackedAccount.accountUserName
    );

    // Add all the missing games and their achievements to our DB.
    const newlyAddedGames =
      await this.syncService.addRetroachievementsTitlesToDb(
        missingGameServiceTitleIds
      );

    // Update all the stale games and their achievements in our DB.
    const updatedGames =
      await this.syncService.updateRetroachievementsTitlesInDb(
        staleGameServiceTitleIds
      );

    // For every game we just added, we'll want to also sync
    // the user's progress for that game.
    const serviceTitleIdsToSyncUserProgress = [
      ...newlyAddedGames.map((game) => game.serviceTitleId),
      ...updatedGames.map((game) => game.serviceTitleId),
      ...existingGameServiceTitleIds
    ];
    await this.syncService.queueSyncUserProgressJobsForRetroachievementsGames(
      serviceTitleIdsToSyncUserProgress,
      allUserGames,
      job.data.trackedAccount
    );
  }

  @Process({
    name: syncJobNames.syncRetroachievementsUserGameProgress,
    concurrency: 2
  })
  async processSyncRetroachievementsUserGameProgress(
    job: Job<SyncUserGameProgressPayload>
  ) {
    // We'll either be updating an existing userGameProgress
    // entity or creating an entirely new one.
    const foundUserGameProgress =
      await this.dbService.findCompleteUserGameProgress(
        job.data.trackedAccount.id,
        job.data.storedGameId
      );

    // If a UserGameProgress entity doesn't exist, we have to
    // create a new one before doing anything else.
    if (!foundUserGameProgress) {
      this.#logger.log(
        `Missing UserGameProgress for RA:${job.data.trackedAccount.id}:${job.data.storedGameId}`
      );

      await this.syncService.createRetroachievementsUserGameProgress(
        job.data.storedGameId,
        job.data.trackedAccount,
        job.data.serviceTitleId
      );
    } else if (
      foundUserGameProgress.earnedAchievements.length !==
      job.data.serviceReportedEarnedAchievementCount
    ) {
      this.#logger.log(
        `Found UserGameProgress for RA:${job.data.trackedAccount.id}:${
          job.data.storedGameId
        }. Missing ${
          job.data.serviceReportedEarnedAchievementCount -
          foundUserGameProgress.earnedAchievements.length
        } reported earned achievements.`
      );

      // This will erase the existing achievements attached to
      // the UserGameProgress entity and create an entirely new set.
      await this.syncService.updateRetroachievementsUserGameProgress(
        foundUserGameProgress,
        job.data.storedGameId,
        job.data.trackedAccount,
        job.data.serviceTitleId
      );
    }
  }

  @Process({
    name: syncJobNames.syncXboxUserGameProgress,
    concurrency: 2
  })
  async processSyncXboxUserGameProgress(job: Job<SyncUserGameProgressPayload>) {
    // We'll either be updating an existing userGameProgress
    // entity or creating an entirely new one.
    const foundUserGameProgress =
      await this.dbService.findCompleteUserGameProgress(
        job.data.trackedAccount.id,
        job.data.storedGameId
      );

    const foundGame = await this.dbService.db.game.findFirst({
      where: { id: job.data.storedGameId }
    });

    // If a UserGameProgress entity doesn't exist, we have to
    // create a new one before doing anything else.
    if (!foundUserGameProgress) {
      this.#logger.log(
        `Missing UserGameProgress for XBOX:${job.data.trackedAccount.id}:${job.data.storedGameId}`
      );

      await this.syncService.createXboxUserGameProgress(
        foundGame,
        job.data.trackedAccount
      );
    } else {
      let trackedUnlockedGamerscore = 0;
      for (const earnedAchievement of foundUserGameProgress.earnedAchievements) {
        trackedUnlockedGamerscore +=
          earnedAchievement.achievement.vanillaPoints;
      }

      if (
        trackedUnlockedGamerscore !== job.data.serviceReportedEarnedGamerscore
      ) {
        this.#logger.log(
          `Found UserGameProgress for XBOX:${job.data.trackedAccount.id}:${
            job.data.storedGameId
          }. Missing ${
            (job.data.serviceReportedEarnedGamerscore ?? 0) -
            trackedUnlockedGamerscore
          } reported gamerscore.`
        );

        // This will erase the existing achievements attached to
        // the UserGameProgress entity and create an entirely new set.
        await this.syncService.updateXboxUserGameProgress(
          foundUserGameProgress,
          foundGame,
          job.data.trackedAccount
        );
      }
    }
  }

  @Process({ name: syncJobNames.syncXboxUserGames, concurrency: 5 })
  async processSyncXboxUserGames(job: Job<SyncUserGamesPayload>) {
    // Virtually all Xbox API calls require a XUID, not a gamertag.
    // We can exchange a gamertag for a XUID, so do that first.
    const trackedAccount = await this.syncService.useTrackedAccountXuid(
      job.data.trackedAccount
    );

    // Get all the user games recorded on XBOX, as well as what games we
    // do and don't currently have stored in our database. Games that we
    // don't have stored, we'll need to fetch and store before we can store
    // the user's actual progress on the game.
    const {
      allUserGames,
      existingGameServiceTitleIds,
      missingGameServiceTitleIds,
      staleGameServiceTitleIds
    } = await this.syncService.getMissingAndPresentUserXboxGames(
      trackedAccount.serviceAccountId,
      trackedAccount.accountUserName
    );

    // Add all the missing games and their achievements to our DB.
    const newlyAddedGames = await this.syncService.addXboxTitlesToDb(
      trackedAccount.serviceAccountId,
      missingGameServiceTitleIds,
      allUserGames
    );

    // Update all the stale games and their achievements in our DB.
    const updatedGames = await this.syncService.updateXboxTitlesInDb(
      trackedAccount.serviceAccountId,
      staleGameServiceTitleIds,
      allUserGames
    );

    // For every game we just added, we'll want to also sync
    // the user's progress for that game.
    const serviceTitleIdsToSyncUserProgress = [
      ...newlyAddedGames.map((game) => game.serviceTitleId),
      ...updatedGames.map((game) => game.serviceTitleId),
      ...existingGameServiceTitleIds
    ];
    await this.syncService.queueSyncUserProgressJobsForXboxGames(
      serviceTitleIdsToSyncUserProgress,
      allUserGames,
      trackedAccount
    );
  }

  @Process({ name: syncJobNames.syncPsnUserGames })
  async processSyncPsnUserGames(job: Job<SyncUserGamesPayload>) {
    // Virtually all PSN API calls require an Account ID, not a username.
    // We can find an Account ID from a given username, so do that first.
    const trackedAccount = await this.syncService.useTrackedAccountPsnAccountId(
      job.data.trackedAccount
    );

    // Get all the user games recorded on PSN, as well as what games we
    // do or don't currently have stored in our database. Games that we
    // don't have stored, we'll need to fetch and store before we can store
    // the user's actual progress on the game.
    const {
      allUserGames,
      existingGameServiceTitleIds,
      missingGameServiceTitleIds
    } = await this.syncService.getMissingAndPresentUserPsnGames(
      trackedAccount.serviceAccountId,
      job.data.trackedAccount.accountUserName
    );

    // PSN is unique in that complete game metadata cannot even be retrieved
    // unless we also fetch and merge the user's progress on a game.
    // Like other services, we'll start by doing work on the games that are
    // missing from our DB. However, we must simultaneously also collect and
    // store the UserGameProgress entities for them. After we have the missing
    // stuff, we'll check if any work is needed on the existing games.
    await this.syncService.addPsnTitlesAndProgressToDb(
      trackedAccount,
      missingGameServiceTitleIds,
      allUserGames
    );
  }
}
