import { Injectable, Logger } from "@nestjs/common";
import { Queue } from "bull";
import { InjectQueue } from "@nestjs/bull";

import { retroachievementsJobNames as jobNames } from "./retroachievements-job-names";
import { RetroachievementsDataService } from "./retroachievements-data.service";
import type { LoadAllUserGamesPayload } from "./models";

@Injectable()
export class RetroachievementsService {
  #logger = new Logger(RetroachievementsService.name);

  constructor(
    @InjectQueue("retroachievements")
    private readonly retroachievementsQueue: Queue,
    private readonly dataService: RetroachievementsDataService
  ) {}

  async loadAllGamesForUser(targetUserName: string) {
    const allUserGames = await this.dataService.fetchAllUserGames(
      targetUserName
    );

    return allUserGames;

    // const allUserGameProgress = await this.dataService.fetchAllUserGameProgress(
    //   targetUserName,
    //   allUserGames.map((game) => game.gameId)
    // );

    // return allUserGameProgress;
  }

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
