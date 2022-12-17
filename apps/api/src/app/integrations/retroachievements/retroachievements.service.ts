import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";

import { retroachievementsJobNames as jobNames } from "./retroachievements-job-names";
import type { LoadAllUserGamesPayload, SyncAccountPayload } from "./models";

@Injectable()
export class RetroachievementsService {
  constructor(
    @InjectQueue("retroachievements")
    private readonly retroachievementsQueue: Queue
  ) {}

  async syncAccount(targetUserName: string) {
    // Start by getting all the account's games.
    const payload: LoadAllUserGamesPayload = { targetUserName };

    const newJob = await this.retroachievementsQueue.add(
      jobNames.loadAllUserGames,
      payload
    );
  }
}
