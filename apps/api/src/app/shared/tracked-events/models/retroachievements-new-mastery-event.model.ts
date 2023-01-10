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

  totalGamePoints: number;
  userMasteryCount: number;
}
