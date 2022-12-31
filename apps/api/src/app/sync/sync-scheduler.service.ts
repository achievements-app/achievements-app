import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { DbService } from "@/api/shared/db/db.service";
import { Logger } from "@/api/shared/logger/logger.service";

import { SyncQueueingService } from "./sync-queueing.service";

// https://crontab.guru/every-5-minutes
const EVERY_FIVE_MINUTES = "*/5 * * * *";

@Injectable()
export class SyncSchedulerService {
  #logger = new Logger(SyncSchedulerService.name);

  constructor(
    private readonly dbService: DbService,
    private readonly syncQueueingService: SyncQueueingService
  ) {}

  @Cron(EVERY_FIVE_MINUTES)
  async runHighPrioritySync() {
    this.#logger.log("Running high priority sync task.");

    const allHighPriorityUsers =
      await this.dbService.findAllHighPriorityUsers();

    for (const user of allHighPriorityUsers) {
      for (const trackedAccount of user.trackedAccounts) {
        this.#logger.log(
          `Starting a high priority sync for ${user.userName}:${trackedAccount.gamingService}:${trackedAccount.accountUserName}`
        );

        await this.syncQueueingService.beginAccountSync(trackedAccount);
      }
    }
  }
}
