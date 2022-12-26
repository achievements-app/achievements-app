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

import { DbService } from "@/api/shared/db/db.service";
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
    name: syncJobNames.syncXboxUserGames
  })
  async processSyncXboxUserGames(job: Job<SyncUserGamesPayload>) {
    // Virtually all Xbox API calls require a XUID, not a gamertag.
    // We can exchange a gamertag for a XUID, so do that first.
    const userXuid = await this.syncService.useTrackedAccountXuid(
      job.data.trackedAccount
    );

    // Get all the user games recorded on XBOX, as well as what games we
    // do and don't currently have stored in our database. Games that we
    // don't have stored, we'll need to fetch and store before we can store
    // the user's actual progress on the game.
    const {
      allUserGames,
      existingGameServiceTitleIds,
      missingGameServiceTitleIds
    } = await this.syncService.getMissingAndPresentUserXboxGames(
      userXuid,
      job.data.trackedAccount.accountUserName
    );

    // TODO: Every game that's missing, fetch from XBOX.
    // Can we fetch multiple games in a single query?
  }
}
