import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { DbService } from "@/api/shared/db/db.service";
import { Logger } from "@/api/shared/logger/logger.service";

import { SyncQueueingService } from "./sync-queueing.service";

const canRunScheduledTasks =
  process.env?.["ARE_SCHEDULED_TASKS_ENABLED"] === "true";

// https://crontab.guru/every-5-minutes
const EVERY_FIVE_MINUTES = "*/5 * * * *";

// https://unix.stackexchange.com/a/16094
const EVERY_TWO_DAYS = "0 0 1-31/2 * *";

@Injectable()
export class SyncSchedulerService {
  #logger = new Logger(SyncSchedulerService.name);

  constructor(
    private readonly dbService: DbService,
    private readonly syncQueueingService: SyncQueueingService
  ) {}

  @Cron(EVERY_FIVE_MINUTES)
  async runHighPriorityPartialSync() {
    if (!canRunScheduledTasks) {
      return;
    }

    this.#logger.log("Running high priority partial sync task.");

    const allHighPriorityUsers =
      await this.dbService.findAllHighPriorityUsers();

    for (const user of allHighPriorityUsers) {
      for (const trackedAccount of user.trackedAccounts) {
        this.#logger.log(
          `Starting a high priority partial sync for ${user.userName}:${trackedAccount.gamingService}:${trackedAccount.accountUserName}`
        );

        await this.syncQueueingService.beginAccountSync(
          trackedAccount,
          "partial"
        );
      }
    }
  }

  @Cron(EVERY_TWO_DAYS)
  async runHighPriorityFullSync() {
    if (!canRunScheduledTasks) {
      return;
    }

    this.#logger.log("Running high priority full sync task.");

    const allHighPriorityUsers =
      await this.dbService.findAllHighPriorityUsers();

    for (const user of allHighPriorityUsers) {
      for (const trackedAccount of user.trackedAccounts) {
        this.#logger.log(
          `Starting a high priority full sync for ${user.userName}:${trackedAccount.gamingService}:${trackedAccount.accountUserName}`
        );

        await this.syncQueueingService.beginAccountSync(trackedAccount, "full");
      }
    }
  }
}
