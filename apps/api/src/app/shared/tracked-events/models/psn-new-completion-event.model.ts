import type { Prisma } from "@prisma/client";

export interface PsnNewCompletionEvent extends Prisma.InputJsonObject {
  game: {
    hasPlatinum: boolean;
    name: string;
    serviceTitleId: string;
    trophyGroupCount: number;
  };

  hardestAchievement: {
    name: string;
    description: string;
    kind: "bronze" | "silver" | "gold";
  };

  appUserName: string;
  appUserDiscordId: string;
  trackedAccountUserName: string;
  userCompletionCount: number;
}
