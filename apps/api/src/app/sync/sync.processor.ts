import {
  InjectQueue,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueError,
  OnQueueFailed,
  Process,
  Processor
} from "@nestjs/bull";
import { type Job, Queue } from "bull";

import { DbService } from "@/api/db/db.service";
import { Logger } from "@/api/shared/logger/logger.service";

import { SyncUserGameProgressPayload, SyncUserGamesPayload } from "./models";
import { SyncService } from "./sync.service";
import { syncJobNames } from "./sync-job-names";

@Processor("sync")
export class SyncProcessor {
  #logger = new Logger(SyncProcessor.name);

  constructor(
    @InjectQueue("sync") private readonly syncQueue: Queue,
    private readonly syncService: SyncService,
    private readonly dbService: DbService
  ) {}

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

  @Process(syncJobNames.syncRetroachievementsUserGames)
  async processSyncRetroachievementsUserGames(job: Job<SyncUserGamesPayload>) {
    // Get all the user games recorded on RA, as well as what games we
    // do and don't currently have stored in our database. Games that we
    // don't have stored, we'll need to fetch and store before we can store
    // the user's actual progress on the games.
    const {
      allUserGames,
      existingGameServiceTitleIds,
      missingGameServiceTitleIds
    } = await this.syncService.getMissingAndPresentUserRetroachievementsGames(
      job.data.trackedAccount.accountUserName
    );

    // Add all the missing games and their achievements to our DB.
    const newlyAddedGames =
      await this.syncService.addRetroachievementsTitlesToDb(
        missingGameServiceTitleIds,
        allUserGames
      );

    // For every game we just added, we'll want to also sync
    // the user's progress for that game.
    const serviceTitleIdsToSyncUserProgress = [
      ...newlyAddedGames.map((game) => game.serviceTitleId),
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

    // If a userGameProgress entity doesn't exist, we have to
    // create a new one before doing anything else.
    if (!foundUserGameProgress) {
      this.#logger.log(`Missing UserGameProgress for ${job.data.storedGameId}`);

      await this.syncService.createRetroachievementsUserGameProgress(
        job.data.storedGameId,
        job.data.trackedAccount,
        job.data.serviceTitleId
      );
    } else if (
      foundUserGameProgress.earnedAchievements.length !==
      job.data.serviceReportedEarnedAchievementCount
    ) {
      this.#logger.log(`
        Found UserGameProgress for ${job.data.storedGameId}.
        Missing ${
          job.data.serviceReportedEarnedAchievementCount -
          foundUserGameProgress.earnedAchievements.length
        } reported earned achievements.
      `);

      await this.dbService.cleanUserGameProgress(foundUserGameProgress);

      await this.syncService.updateRetroachievementsUserGameProgress(
        foundUserGameProgress,
        job.data.storedGameId,
        job.data.trackedAccount,
        job.data.serviceTitleId
      );
    } else {
      this.#logger.log(
        `No work needed for ${job.data.trackedAccount.accountUserName} ${job.data.serviceTitleId}`
      );
    }
  }
}