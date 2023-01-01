import type { GamingService } from "@achievements-app/data-access-db";

import type { PublicUserAchievement } from "./public-user-achievement.model";
import type { TrophyTypeCounts } from "./trophy-type-counts.model";

export interface PublicUserGameProgress {
  name: string;
  platforms: string[];
  gamingService: GamingService;
  imageUrl: string;
  lastEarnedOn: string | null;

  achievements: PublicUserAchievement[];

  completedOn: string | null;
  gameTotalPossiblePoints?: number;
  gameTrophyTypeCounts?: TrophyTypeCounts;
  userEarnedTrophyTypeCounts?: TrophyTypeCounts;
}
