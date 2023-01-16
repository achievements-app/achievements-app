import type { Prisma } from "@prisma/client";

export interface XboxNewCompletionEvent extends Prisma.InputJsonObject {
  game: {
    name: string;
    serviceTitleId: string;
  };

  hardestAchievement: {
    name: string;
    description: string;
    points: number;
  };

  appUserName: string;
  trackedAccountUserName: string;
  totalGamePoints: number;
  userCompletionCount: number;
}
