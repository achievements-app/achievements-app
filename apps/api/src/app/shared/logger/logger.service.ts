import { ConsoleLogger, Injectable, Scope } from "@nestjs/common";
import type { JobId } from "bull";

@Injectable({ scope: Scope.TRANSIENT })
export class Logger extends ConsoleLogger {
  logActiveJob(jobName: string, jobId: JobId, jobData: unknown) {
    this.log(
      `Processing job ${jobId} ${jobName} with payload ${JSON.stringify(
        jobData
      )}`
    );
  }

  logCompletedJob(jobName: string, jobId: JobId, jobData: unknown) {
    this.log(
      `Completed job ${jobId} ${jobName} with payload ${JSON.stringify(
        jobData
      )}`
    );
  }

  logErrorJob(error: Error) {
    this.error("Job error", error);
  }

  logFailedJob(jobName: string, jobId: JobId, jobData: unknown, error: Error) {
    this.error(
      `Failed job ${jobId} ${jobName} with payload ${JSON.stringify(jobData)}`,
      error
    );
  }

  logQueueingJob(jobName: string, payload: unknown) {
    this.log(`Queueing job ${jobName} with payload ${JSON.stringify(payload)}`);
  }

  logQueuedJob(jobName: string, jobId: JobId) {
    this.log(`Queued job ${jobName} with ID ${jobId}`);
  }
}
