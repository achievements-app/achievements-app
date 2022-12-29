import type { TrophyTitle } from "psn-api";

import type { MappedGame } from "@achievements-app/data-access-common-models";

export const mapTrophyTitleToStoredGame = (
  trophyTitle: TrophyTitle
): MappedGame => {
  const earnedTrophiesCounts = trophyTitle.earnedTrophies;
  const knownUserEarnedAchievementCount =
    earnedTrophiesCounts.bronze +
    earnedTrophiesCounts.silver +
    earnedTrophiesCounts.gold +
    earnedTrophiesCounts.platinum;

  return {
    knownUserEarnedAchievementCount,
    name: trophyTitle.trophyTitleName,
    gamingService: "PSN",
    psnServiceName: trophyTitle.npServiceName,
    serviceTitleId: trophyTitle.npCommunicationId
  };
};
