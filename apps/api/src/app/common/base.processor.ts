import {
  OnQueueActive,
  OnQueueCompleted,
  OnQueueError,
  OnQueueFailed,
  OnQueueStalled
} from "@nestjs/bull";
import { InjectSentry, SentryService } from "@ntegral/nestjs-sentry";
import type { Job } from "bull";

import { Logger } from "@/api/shared/logger/logger.service";

export abstract class BaseProcessor {
  protected abstract logger: Logger;

  constructor(@InjectSentry() protected sentryClient: SentryService) {}

  @OnQueueStalled()
  onStalled(job: Job) {
    this.logger.warn(`JOB STALLED ${job.id}`);
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(
      `Processing job ${job.id} ${job.name} with payload ${JSON.stringify(
        job.data
      )}`
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    this.logger.log(
      `Completed job ${job.id} ${job.name} with payload ${JSON.stringify(
        job.data
      )}`
    );
  }

  @OnQueueError()
  onError(error: Error) {
    this.logger.error("Job error", error);

    this.sentryClient.instance().captureException(error);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Failed job ${job.id} ${job.name} with payload ${JSON.stringify(
        job.data
      )}`,
      error
    );

    this.sentryClient.instance().captureException(error);
  }
}
