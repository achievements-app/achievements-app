import { ConsoleLogger, Injectable, Scope } from "@nestjs/common";
import type { JobId } from "bull";

@Injectable({ scope: Scope.TRANSIENT })
export class Logger extends ConsoleLogger {
  logQueueingJob(jobName: string, payload: unknown) {
    this.log(`Queueing job ${jobName} with payload ${JSON.stringify(payload)}`);
  }

  logQueuedJob(jobName: string, jobId: JobId) {
    this.log(`Queued job ${jobName} with ID ${jobId}`);
  }
}
