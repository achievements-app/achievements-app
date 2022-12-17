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
import { Queue, type Job } from "bull";
import pLimit from "p-limit";

import { RetroachievementsDataService } from "../retroachievements-data.service";
import type {
  LoadAllUserGameProgressPayload,
  LoadAllUserGamesPayload
} from "../models";
import { retroachievementsJobNames as jobNames } from "../retroachievements-job-names";
import { DbService } from "../../../db/db.service";
import {
  Achievement,
  GameInfoAndUserProgress,
  UserGameCompletion
} from "retroachievements-js";

@Processor("old-retroachievements")
export class OldRetroachievementsProcessor {
  #logger = new Logger(OldRetroachievementsProcessor.name);

  constructor(
    @InjectQueue("old-retroachievements")
    private readonly retroachievementsQueue: Queue,
    private readonly dataService: RetroachievementsDataService,
    private readonly db: DbService
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

  @Process(jobNames.loadAllUserGames)
  async loadAllUserGames(job: Job<LoadAllUserGamesPayload>) {
    const allUserGames = await this.dataService.fetchAllUserGames(
      job.data.targetUserName
    );

    const payload: LoadAllUserGameProgressPayload = {
      userName: job.data.targetUserName,
      ids: []
    };

    for (const game of allUserGames) {
      const upsertedGame = await this.upsertGameToDb(game);

      payload.ids.push({
        gameId: upsertedGame.id,
        serviceTitleId: String(game.gameId)
      });
    }

    this.#logger.log(
      `QUEUEING JOB ${jobNames.loadAllUserGameProgress} ${JSON.stringify(
        payload
      )}.`
    );
    const newJob = await this.retroachievementsQueue.add(
      jobNames.loadAllUserGameProgress,
      payload,
      {
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 30000
        }
      }
    );
    this.#logger.log(`QUEUED JOB ${newJob.id} ${newJob.name}.`);

    return allUserGames;
  }

  @Process({ name: jobNames.loadAllUserGameProgress, concurrency: 1 })
  async loadAllUserGameProgress(job: Job<LoadAllUserGameProgressPayload>) {
    const concurrencyLimit = pLimit(2);
    const concurrentPromises: Promise<GameInfoAndUserProgress>[] = [];
    for (const entityIds of job.data.ids) {
      concurrentPromises.push(
        concurrencyLimit(() =>
          this.dataService.fetchUserGameProgress(
            job.data.userName,
            Number(entityIds.serviceTitleId)
          )
        )
      );
    }

    const userGameProgressEntities = await Promise.all(concurrentPromises);

    for (const userGameProgress of userGameProgressEntities) {
      for (const achievement of userGameProgress.achievements) {
        // Make sure this achievement is up to date in our DB.
        await this.upsertGameAchievementToDb(
          job.data.ids.find(
            (ids) => ids.serviceTitleId === String(userGameProgress.id)
          ).gameId,
          achievement
        );

        // TODO: Update the user game progress.
      }
    }
  }

  private async upsertGameToDb(game: UserGameCompletion) {
    const upsertedGame = await this.db.game.upsert({
      where: {
        gamingService_serviceTitleId: {
          gamingService: "RA",
          serviceTitleId: String(game.gameId)
        }
      },
      create: {
        gamingService: "RA",
        name: game.title,
        serviceTitleId: String(game.gameId),
        gamePlatforms: [game.consoleName]
      },
      update: {
        name: game.title
      }
    });

    return upsertedGame;
  }

  private async upsertGameAchievementToDb(
    gameId: string,
    gameAchievement: Achievement
  ) {
    await this.db.gameAchievement.upsert({
      where: {
        gameId_serviceAchievementId: {
          serviceAchievementId: String(gameAchievement.id),
          gameId
        }
      },
      create: {
        game: {
          connect: {
            id: gameId
          }
        },
        serviceAchievementId: String(gameAchievement.id),
        name: gameAchievement.title,
        description: gameAchievement.description,
        vanillaPoints: gameAchievement.points,
        ratioPoints: gameAchievement.trueRatio,
        sourceImageUrl: `https://media.retroachievements.org/Badge/${gameAchievement.badgeName}.png`
        // TODO: serviceEarnedPercentage
      },
      update: {
        name: gameAchievement.title,
        description: gameAchievement.description,
        vanillaPoints: gameAchievement.points,
        ratioPoints: gameAchievement.trueRatio,
        sourceImageUrl: `https://media.retroachievements.org/Badge/${gameAchievement.badgeName}.png`
        // TODO: serviceEarnedPercentage
      }
    });
  }
}
