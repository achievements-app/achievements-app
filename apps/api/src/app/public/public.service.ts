import { Injectable } from "@nestjs/common";

import type { TrackedAccount } from "@achievements-app/data-access-db";

import { DbService } from "@/api/shared/db/db.service";

import type { PublicUserGameProgress } from "./models/public-user-game-progress.model";
import { mapCompleteUserGameProgressToPublicUserGameProgress } from "./utils/mapCompleteUserGameProgressToPublicUserGameProgress";

@Injectable()
export class PublicService {
  constructor(private readonly dbService: DbService) {}

  async getAllTrackedAccountPublicUserGameProgress(
    trackedAccount: TrackedAccount
  ): Promise<PublicUserGameProgress[]> {
    const allCompleteUserGameProgresses =
      await this.dbService.findAllCompleteUserGameProgress(trackedAccount.id);

    return allCompleteUserGameProgresses.map(
      mapCompleteUserGameProgressToPublicUserGameProgress
    );
  }
}
