import type { Prisma } from "@prisma/client";

export interface RetroachievementsHundredPointUnlockEvent
  extends Prisma.InputJsonObject {
  game: {
    name: string;
    consoleName: string;
    serviceTitleId: string;
  };

  achievement: {
    name: string;
    description: string;
    serviceAchievementId: string;
  };

  appUserName: string;
  trackedAccountUserName: string;
  userHundredPointUnlocksCount: number;
  totalRaUnlockerCount: number;
}
