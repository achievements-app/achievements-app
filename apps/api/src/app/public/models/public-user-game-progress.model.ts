import type { GamingService } from "@achievements-app/data-access-db";

interface TrophyTypeCounts {
  bronze: number;
  silver: number;
  gold: number;
  platinum: number;
}

interface PublicUserEarnedAchievement {
  isEarned: boolean;

  earnedRate?: number;
  points?: number;
  type?: "bronze" | "silver" | "gold" | "platinum";
  earnedOn?: string;
}

export interface PublicUserGameProgress {
  gameName: string;
  platforms: string[];
  gamingService: GamingService;

  achievementsList: PublicUserEarnedAchievement[];

  gameTrophyTypeCounts?: TrophyTypeCounts;
  userEarnedTrophyTypeCounts?: TrophyTypeCounts;
}
