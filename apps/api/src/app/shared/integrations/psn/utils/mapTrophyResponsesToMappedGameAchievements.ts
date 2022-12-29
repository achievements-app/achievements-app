import type {
  TitleTrophiesResponse,
  UserTrophiesEarnedForTitleResponse
} from "psn-api";

import type { MappedGameAchievement } from "@achievements-app/data-access-common-models";
import type { PsnTrophyKind } from "@achievements-app/data-access-db";

export const mapTrophyResponsesToMappedGameAchievements = (
  titleTrophiesResponse: TitleTrophiesResponse,
  userTrophiesEarnedForTitleResponse: UserTrophiesEarnedForTitleResponse
): MappedGameAchievement[] => {
  const mappedGameAchievements: MappedGameAchievement[] = [];

  const titleTrophies = titleTrophiesResponse.trophies;
  const earnedTrophies = userTrophiesEarnedForTitleResponse.trophies;

  for (const titleTrophy of titleTrophies) {
    const matchingEarnedTrophy = earnedTrophies.find(
      (earnedTrophy) => earnedTrophy.trophyId === titleTrophy.trophyId
    );

    mappedGameAchievements.push({
      name: titleTrophy.trophyName ?? "",
      description: titleTrophy.trophyDetail ?? null,
      serviceAchievementId: String(titleTrophy.trophyId),
      psnTrophyKind: trophyTypeDictionary[titleTrophy.trophyType],
      sourceImageUrl: titleTrophy.trophyIconUrl ?? null,
      isEarned: matchingEarnedTrophy.earned ? true : false,
      earnedOn: matchingEarnedTrophy.earnedDateTime,
      knownEarnerPercentage: Number(matchingEarnedTrophy.trophyEarnedRate)
    });
  }

  return mappedGameAchievements;
};

const trophyTypeDictionary: Record<string, PsnTrophyKind> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum"
};
