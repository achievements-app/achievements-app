import { Process, Processor } from "@nestjs/bull";
import { InjectSentry, SentryService } from "@ntegral/nestjs-sentry";
import { type Job } from "bull";

import { BaseProcessor } from "@/api/common/base.processor";
import { DbService } from "@/api/shared/db/db.service";
import { PsnService } from "@/api/shared/integrations/psn/psn.service";
import { RetroachievementsService } from "@/api/shared/integrations/retroachievements/retroachievements.service";
import { XboxService } from "@/api/shared/integrations/xbox/xbox.service";
import { Logger } from "@/api/shared/logger/logger.service";

import { SyncUserGameProgressPayload, SyncUserGamesPayload } from "./models";
import { SyncService } from "./sync.service";
import { syncJobNames } from "./sync-job-names";

@Processor("sync")
export class SyncProcessor extends BaseProcessor {
  protected readonly logger = new Logger(SyncProcessor.name);

  constructor(
    @InjectSentry() protected sentryClient: SentryService,
    private readonly dbService: DbService,
    private readonly psnService: PsnService,
    private readonly retroachievementsService: RetroachievementsService,
    private readonly syncService: SyncService,
    private readonly xboxService: XboxService
  ) {
    super(sentryClient);
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
    } =
      await this.retroachievementsService.getMissingAndPresentUserRetroachievementsGames(
        job.data.trackedAccount.accountUserName
      );

    // Add all the missing games and their achievements to our DB.
    const newlyAddedGames =
      await this.retroachievementsService.addRetroachievementsTitlesToDb(
        missingGameServiceTitleIds
      );

    // Update all the stale games and their achievements in our DB.
    const updatedGames =
      await this.retroachievementsService.updateRetroachievementsTitlesInDb(
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
      this.logger.log(
        `Missing UserGameProgress for RA:${job.data.trackedAccount.id}:${job.data.storedGameId}`
      );

      await this.retroachievementsService.createRetroachievementsUserGameProgress(
        job.data.storedGameId,
        job.data.trackedAccount,
        job.data.serviceTitleId
      );
    } else if (
      foundUserGameProgress.earnedAchievements.length !==
      job.data.serviceReportedEarnedAchievementCount
    ) {
      this.logger.log(
        `Found UserGameProgress for RA:${job.data.trackedAccount.id}:${
          job.data.storedGameId
        }. Missing ${
          job.data.serviceReportedEarnedAchievementCount -
          foundUserGameProgress.earnedAchievements.length
        } reported earned achievements.`
      );

      // This will erase the existing achievements attached to
      // the UserGameProgress entity and create an entirely new set.
      await this.retroachievementsService.updateRetroachievementsUserGameProgress(
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
      this.logger.log(
        `Missing UserGameProgress for XBOX:${job.data.trackedAccount.id}:${job.data.storedGameId}`
      );

      await this.xboxService.createXboxUserGameProgress(
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
        this.logger.log(
          `Found UserGameProgress for XBOX:${job.data.trackedAccount.id}:${
            job.data.storedGameId
          }. Missing ${
            (job.data.serviceReportedEarnedGamerscore ?? 0) -
            trackedUnlockedGamerscore
          } reported gamerscore.`
        );

        // This will erase the existing achievements attached to
        // the UserGameProgress entity and create an entirely new set.
        await this.xboxService.updateXboxUserGameProgress(
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
    const trackedAccount = await this.xboxService.useTrackedAccountXuid(
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
    } = await this.xboxService.getMissingAndPresentUserXboxGames(
      trackedAccount.serviceAccountId,
      trackedAccount.accountUserName
    );

    // Add all the missing games and their achievements to our DB.
    const newlyAddedGames = await this.xboxService.addXboxTitlesToDb(
      trackedAccount.serviceAccountId,
      missingGameServiceTitleIds,
      allUserGames
    );

    // Update all the stale games and their achievements in our DB.
    const updatedGames = await this.xboxService.updateXboxTitlesInDb(
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

  @Process({ name: syncJobNames.syncPsnUserGameProgress, concurrency: 6 })
  async processSyncPsnUserGameProgress(job: Job<SyncUserGameProgressPayload>) {
    await this.psnService.updatePsnTitleAndProgressInDb(
      job.data.trackedAccount,
      job.data.targetUserGame
    );
  }

  @Process({ name: syncJobNames.syncPsnUserMissingGame, concurrency: 6 })
  async processSyncPsnUserMissingGame(job: Job<SyncUserGameProgressPayload>) {
    await this.psnService.addPsnTitleAndProgressToDb(
      job.data.trackedAccount,
      job.data.targetUserGame
    );
  }

  @Process({ name: syncJobNames.syncPsnUserGames })
  async processSyncPsnUserGames(job: Job<SyncUserGamesPayload>) {
    // Virtually all PSN API calls require an Account ID, not a username.
    // We can find an Account ID from a given username, so do that first.
    const trackedAccount = await this.psnService.useTrackedAccountPsnAccountId(
      // DANGER: ONLY USE `job.data.trackedAccount` HERE.
      // EVERYWHERE ELSE, USE `trackedAccount`.
      job.data.trackedAccount
    );

    // Get all the user games recorded on PSN, as well as what games we
    // do or don't currently have stored in our database. Games that we
    // don't have stored, we'll need to fetch and store before we can store
    // the user's actual progress on the game.
    const { allUserGames, missingGameServiceTitleIds } =
      await this.psnService.getMissingAndPresentUserPsnGames(
        trackedAccount.serviceAccountId,
        job.data.trackedAccount.accountUserName
      );

    // PSN is unique in that complete game metadata cannot even be retrieved
    // unless we also fetch and merge the user's progress on a game.
    // Like other services, we'll start by doing work on the games that are
    // missing from our DB. However, we must simultaneously also collect and
    // store the UserGameProgress entities for them. After we have the missing
    // stuff, we'll check if any work is needed on the existing games.
    await this.syncService.queueSyncJobsForUserMissingPsnGames(
      missingGameServiceTitleIds,
      allUserGames,
      trackedAccount
    );

    // Now tackle the existing games. We need to do work on any games that
    // already exist in our DB that have no UserGameProgress and we know the
    // user has progressed on, or games where we're missing reported progress.
    // We know we're missing reported progress because the `knownUserEarnedAchievementCount`
    // value is greater than what we have stored for the game in our DB for the
    // associated user's UserGameProgress.
    this.logger.log(
      `Determining UserGameProgress updates required for PSN account ${trackedAccount.accountUserName}`
    );

    const titleIdsNeedingUpdate =
      await this.psnService.getPsnTitleIdsNeedingUserProgressUpdate(
        trackedAccount,
        // Don't do a double update of games being initially added to the DB.
        allUserGames.filter(
          (userGame) =>
            !missingGameServiceTitleIds.includes(userGame.serviceTitleId)
        )
      );

    this.logger.log(
      `PSN account ${trackedAccount.accountUserName} has ${titleIdsNeedingUpdate.length} titles needing a UserGameProgress update.`
    );

    await this.syncService.queueSyncUserProgressJobsForPsnGames(
      titleIdsNeedingUpdate,
      allUserGames,
      trackedAccount
    );
  }
}
