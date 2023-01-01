import { Injectable } from "@nestjs/common";

import type {
  Game,
  GameAchievement,
  TrackedAccount,
  UserEarnedAchievement,
  UserGameProgress
} from "@achievements-app/data-access-db";

import { DbService } from "@/api/shared/db/db.service";

import type { PublicUserGameProgress } from "./models/public-user-game-progress.model";
import { mapCompleteUserGameProgressToPublicUserGameProgress } from "./utils/mapCompleteUserGameProgressToPublicUserGameProgress";

type CompleteUserGameProgress = UserGameProgress & {
  game: Game & { achievements: GameAchievement[] };
  earnedAchievements: Array<
    UserEarnedAchievement & { achievement: GameAchievement }
  >;
};

@Injectable()
export class PublicService {
  constructor(private readonly dbService: DbService) {}

  async getAllTrackedAccountPublicUserGameProgress(
    trackedAccount: TrackedAccount
  ): Promise<PublicUserGameProgress[]> {
    const allCompleteUserGameProgresses: CompleteUserGameProgress[] =
      await this.dbService.db.userGameProgress.findMany({
        where: { trackedAccountId: trackedAccount.id },
        include: {
          earnedAchievements: {
            include: { achievement: true }
          },
          game: { include: { achievements: true } }
        }
      });

    return allCompleteUserGameProgresses.map(
      mapCompleteUserGameProgressToPublicUserGameProgress
    );
  }
}
