import type { GamingService } from "@achievements-app/data-access-db";

export interface PublicUserAchievement {
  isEarned: boolean;
  name: string;
  description: string;
  gameName: string;
  iconUrl: string;
  gamingService: GamingService;

  psnGroupId?: string;
  earnedRate?: number;
  points?: number;
  psnTrophyKind?: "bronze" | "silver" | "gold" | "platinum";
  earnedOn?: string;
}
