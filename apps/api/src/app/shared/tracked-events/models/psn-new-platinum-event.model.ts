import type { Prisma } from "@prisma/client";

export interface PsnNewPlatinumEvent extends Prisma.InputJsonObject {
  game: {
    name: string;
    serviceTitleId: string;
  };

  hardestAchievement: {
    name: string;
    description: string;
    kind: "bronze" | "silver" | "gold";
  };

  appUserName: string;
  appUserDiscordId: string | null;
  trackedAccountUserName: string;
  userPlatinumCount: number;
}
