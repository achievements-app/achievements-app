import { Injectable, Logger } from "@nestjs/common";
import { Queue } from "bull";
import { InjectQueue } from "@nestjs/bull";

import { retroachievementsJobNames as jobNames } from "../retroachievements-job-names";
import type { LoadAllUserGamesPayload } from "../models";

@Injectable()
export class OldRetroachievementsService {
  #logger = new Logger(OldRetroachievementsService.name);

  constructor(
    @InjectQueue("retroachievements")
    private readonly retroachievementsQueue: Queue
  ) {}

  async queueLoadUserGames(targetUserName: string) {
    const payload: LoadAllUserGamesPayload = { targetUserName };

    this.#logger.log(
      `QUEUEING JOB ${jobNames.loadAllUserGames} ${JSON.stringify(payload)}.`
    );
    const newJob = await this.retroachievementsQueue.add(
      jobNames.loadAllUserGames,
      payload
    );
    this.#logger.log(`QUEUED JOB ${newJob.id} ${newJob.name}.`);
  }
}
