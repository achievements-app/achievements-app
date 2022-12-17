import {
  Processor,
  Process,
  OnQueueError,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
  InjectQueue
} from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { TrackedAccount } from "@prisma/client";
import { Queue, type Job } from "bull";
import { DbService } from "../db/db.service";

import { RetroachievementsDataService } from "../integrations/retroachievements/retroachievements-data.service";

@Processor("sync")
export class SyncProcessor {
  #logger = new Logger(SyncProcessor.name);

  constructor(
    @InjectQueue("sync") private readonly syncQueue: Queue,
    private readonly retroachievementsDataService: RetroachievementsDataService,
    private readonly dbService: DbService
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.#logger.log(
      `PROCESSING JOB ${job.id} ${job.name} ${JSON.stringify(job.data)}`
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    this.#logger.log(
      `COMPLETED JOB ${job.id} ${job.name} ${JSON.stringify(job.data)}`
    );
  }

  @OnQueueError()
  onError(error: Error) {
    this.#logger.log(`JOB ERROR`, error);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.#logger.log(
      `FAILED JOB ${job.id} ${job.name} ${JSON.stringify(job.data)}`,
      error
    );
  }

  @Process("syncUserGames")
  async processSyncUserGames(job: Job<{ trackedAccount: TrackedAccount }>) {
    const allUserGames =
      await this.retroachievementsDataService.fetchAllUserGames(
        job.data.trackedAccount.accountUserName
      );

    const { existingGameServiceTitleIds, missingGameServiceTitleIds } =
      await this.dbService.getMultipleGamesExistenceStatus(
        "RA",
        allUserGames.map((userGame) => String(userGame.gameId))
      );

    this.#logger.log(
      `${job.data.trackedAccount.accountUserName} has ${allUserGames.length} games tracked on RA. ${existingGameServiceTitleIds.length} of these games are in our DB. ${missingGameServiceTitleIds.length} are missing.`
    );

    // Every missing game needs to be added to our database.
    for (const missingGameServiceTitleId of missingGameServiceTitleIds) {
      // Make a subsequent fetch to load all the game's achievements.
      const { achievements } =
        await this.retroachievementsDataService.fetchDeepGameInfo(
          missingGameServiceTitleId
        );

      // Add the game to the database so we can start doing work on it.
      const addedGame = await this.dbService.upsertRetroachievementsGame(
        allUserGames.find(
          (userGame) => userGame.gameId === Number(missingGameServiceTitleId)
        ),
        achievements
      );

      // TODO: Queue a job to sync the user game progress.
    }

    // Queue jobs to sync every user game progress for games already in the DB.
    for (const existingGameServiceTitleId of existingGameServiceTitleIds) {
      const foundGame = await this.dbService.game.findUnique({
        where: {
          gamingService_serviceTitleId: {
            gamingService: "RA",
            serviceTitleId: existingGameServiceTitleId
          }
        }
      });

      const userGame = allUserGames.find(
        (userGame) => userGame.gameId === Number(existingGameServiceTitleId)
      );

      this.syncQueue.add("syncUserGameProgress", {
        trackedAccount: job.data.trackedAccount,
        gameId: foundGame.id,
        serviceTitleId: existingGameServiceTitleId,
        serviceReportedEarnedAchievementCount: userGame.numAwarded
      });
    }
  }

  @Process({ name: "syncUserGameProgress", concurrency: 2 })
  async processSyncUserGameProgress(
    job: Job<{
      trackedAccount: TrackedAccount;
      gameId: string;
      serviceTitleId: string;
      serviceReportedEarnedAchievementCount: number;
    }>
  ) {
    const foundUserGameProgress =
      await this.dbService.userGameProgress.findUnique({
        where: {
          trackedAccountId_gameId: {
            trackedAccountId: job.data.trackedAccount.id,
            gameId: job.data.gameId
          }
        },
        include: { earnedAchievements: true }
      });

    // If there is no userGameProgress entity at all, we
    // need to create a brand new one for the user.
    if (!foundUserGameProgress) {
      this.#logger.log(`Missing user game progress for ${job.data.gameId}`);

      const serviceUserGameProgress =
        await this.retroachievementsDataService.fetchUserGameProgress(
          job.data.trackedAccount.accountUserName,
          job.data.serviceTitleId
        );

      const allGameAchievements = await this.dbService.gameAchievement.findMany(
        {
          where: {
            gameId: job.data.gameId
          }
        }
      );

      this.#logger.log(`Adding UserGameProgress for ${job.data.gameId}`);
      const newUserGameProgress = await this.dbService.userGameProgress.create({
        data: {
          gameId: job.data.gameId,
          trackedAccountId: job.data.trackedAccount.id,
          earnedAchievements: {
            createMany: {
              data: serviceUserGameProgress.achievements
                .filter((achievement) => achievement.dateEarnedHardcore)
                .map((achievement) => {
                  const storedGameAchievement = allGameAchievements.find(
                    (gameAchievement) =>
                      gameAchievement.serviceAchievementId ===
                      String(achievement.id)
                  );

                  // TODO: Throw error if storedGameAchievement not found.

                  return {
                    gameAchievementId: storedGameAchievement.id,
                    // TODO: is this timezone okay?
                    earnedOn: achievement.dateEarnedHardcore
                  };
                }),
              skipDuplicates: true
            }
          }
        }
      });
      this.#logger.log(
        `Added UserGameProgress for ${job.data.gameId}. ${newUserGameProgress.id}`
      );
    } else if (
      foundUserGameProgress.earnedAchievements.length !==
      job.data.serviceReportedEarnedAchievementCount
    ) {
      this.#logger.log(
        `Found user game progress for ${job.data.gameId}. STORED EARNED ACHIEVEMENTS: ${foundUserGameProgress.earnedAchievements.length}. REPORTED EARNED ACHIEVEMENTS: ${job.data.serviceReportedEarnedAchievementCount}.`
      );

      // We'll recreate the list of earned achievements for the userGameProgress object.
      await this.dbService.userEarnedAchievement.deleteMany({
        where: {
          gameProgressEntityId: foundUserGameProgress.id
        }
      });

      const serviceUserGameProgress =
        await this.retroachievementsDataService.fetchUserGameProgress(
          job.data.trackedAccount.accountUserName,
          job.data.serviceTitleId
        );

      const allGameAchievements = await this.dbService.gameAchievement.findMany(
        {
          where: {
            gameId: job.data.gameId
          }
        }
      );

      await this.dbService.userGameProgress.update({
        where: {
          id: foundUserGameProgress.id
        },
        data: {
          earnedAchievements: {
            createMany: {
              data: serviceUserGameProgress.achievements
                .filter((achievement) => achievement.dateEarnedHardcore)
                .map((achievement) => {
                  const storedGameAchievement = allGameAchievements.find(
                    (gameAchievement) =>
                      gameAchievement.serviceAchievementId ===
                      String(achievement.id)
                  );

                  // TODO: Throw error if storedGameAchievement not found.

                  return {
                    gameAchievementId: storedGameAchievement.id,
                    // TODO: is this timezone okay?
                    earnedOn: achievement.dateEarnedHardcore
                  };
                }),
              skipDuplicates: true
            }
          }
        }
      });
    }
  }
}
