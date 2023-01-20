import type { Prisma } from "@prisma/client";

export interface RetroachievementsNewMasteryEvent
  extends Prisma.InputJsonObject {
  game: {
    name: string;
    consoleName: string;
    serviceTitleId: string;
  };

  hardestAchievement: {
    name: string;
    description: string;
    points: number;
  };

  appUserName: string;
  appUserDiscordId: string | null;
  trackedAccountUserName: string;
  totalGamePoints: number;
  userMasteryCount: number;
}
