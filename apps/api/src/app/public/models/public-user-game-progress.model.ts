import type { GamingService } from "@achievements-app/data-access-db";

import type { PublicUserAchievement } from "./public-user-achievement.model";
import type { TrophyTypeCounts } from "./trophy-type-counts.model";

export interface PublicUserGameProgress {
  achievements: PublicUserAchievement[];
  completedOn: string | null;
  gamingService: GamingService;
  imageUrl: string;
  lastEarnedOn: string | null;
  name: string;
  platforms: string[];

  gameTotalPossiblePoints?: number;
  gameTrophyTypeCounts?: TrophyTypeCounts;
  userEarnedTrophyTypeCounts?: TrophyTypeCounts;
}
