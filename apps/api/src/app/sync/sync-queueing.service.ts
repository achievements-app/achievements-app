import { InjectQueue } from "@nestjs/bull";
import { Injectable } from "@nestjs/common";
import type { Queue } from "bull";

import type { TrackedAccount } from "@achievements-app/data-access-db";

import { Logger } from "@/api/shared/logger/logger.service";

import type { SyncQueuePayload, SyncUserGamesPayload } from "./models";
import { syncJobNames } from "./sync-job-names";

@Injectable()
export class SyncQueueingService {
  #logger = new Logger(SyncQueueingService.name);

  constructor(
    @InjectQueue("sync")
    private readonly syncQueue: Queue<SyncQueuePayload>
  ) {}

  beginAccountSync(trackedAccount: TrackedAccount) {
    if (trackedAccount.gamingService === "PSN") {
      return this.beginPsnAccountSync(trackedAccount);
    }

    if (trackedAccount.gamingService === "RA") {
      return this.beginRetroachievementsAccountSync(trackedAccount);
    }

    if (trackedAccount.gamingService === "XBOX") {
      return this.beginXboxAccountSync(trackedAccount);
    }
  }

  async beginPsnAccountSync(trackedAccount: TrackedAccount) {
    const payload: SyncUserGamesPayload = {
      trackedAccount
    };

    this.#logger.logQueueingJob(syncJobNames.syncPsnUserGames, payload);
    const newJob = await this.syncQueue.add(
      syncJobNames.syncPsnUserGames,
      payload,
      { attempts: 6, backoff: 60000 }
    );
    this.#logger.logQueuedJob(newJob.name, newJob.id);
  }

  async beginRetroachievementsAccountSync(trackedAccount: TrackedAccount) {
    const payload: SyncUserGamesPayload = {
      trackedAccount
    };

    this.#logger.logQueueingJob(
      syncJobNames.syncRetroachievementsUserGames,
      payload
    );
    const newJob = await this.syncQueue.add(
      syncJobNames.syncRetroachievementsUserGames,
      payload,
      { attempts: 6, backoff: 60000 }
    );
    this.#logger.logQueuedJob(newJob.name, newJob.id);
  }

  async beginXboxAccountSync(trackedAccount: TrackedAccount) {
    const payload: SyncUserGamesPayload = {
      trackedAccount
    };

    this.#logger.logQueueingJob(syncJobNames.syncXboxUserGames, payload);
    const newJob = await this.syncQueue.add(
      syncJobNames.syncXboxUserGames,
      payload,
      { attempts: 6, backoff: 60000 }
    );
    this.#logger.logQueuedJob(newJob.name, newJob.id);
  }
}
