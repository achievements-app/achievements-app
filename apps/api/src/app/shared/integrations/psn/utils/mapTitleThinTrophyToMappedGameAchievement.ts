import type { TitleThinTrophy } from "psn-api";

import type { MappedGameAchievement } from "@achievements-app/data-access-common-models";
import type { PsnTrophyKind } from "@achievements-app/data-access-db";

export const mapTitleThinTrophyToMappedGameAchievement = (
  titleThinTrophy: TitleThinTrophy
): MappedGameAchievement => {
  return {
    name: titleThinTrophy.trophyName ?? "",
    description: titleThinTrophy.trophyDetail ?? "",
    serviceAchievementId: String(titleThinTrophy.trophyId),
    psnTrophyKind: trophyTypeDictionary[titleThinTrophy.trophyType]
  };
};

const trophyTypeDictionary: Record<string, PsnTrophyKind> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum"
};
