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

import { RetroachievementsDataService } from "./retroachievements-data.service";
import type {
  LoadAllUserGamesPayload,
  LoadUserGameProgressPayload
} from "./models";
import { retroachievementsJobNames as jobNames } from "./retroachievements-job-names";

@Processor("retroachievements")
export class RetroachievementsProcessor {
  #logger = new Logger(RetroachievementsProcessor.name);

  constructor(
    @InjectQueue("retroachievements")
    private readonly retroachievementsQueue: Queue,
    private readonly dataService: RetroachievementsDataService
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

    for (const game of allUserGames) {
      const payload: LoadUserGameProgressPayload = {
        userName: job.data.targetUserName,
        gameId: game.gameId
      };

      this.retroachievementsQueue.add(jobNames.loadUserGameProgress, payload);
    }

    return allUserGames;
  }

  @Process(jobNames.loadUserGameProgress)
  async loadUserGameProgress(job: Job<LoadUserGameProgressPayload>) {
    const userGameProgress = await this.dataService.fetchUserGameProgress(
      job.data.userName,
      job.data.gameId
    );

    return userGameProgress;
  }
}
