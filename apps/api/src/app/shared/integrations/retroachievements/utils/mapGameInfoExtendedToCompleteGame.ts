import type {
  GameExtended,
  GameExtendedAchievementEntity
} from "@retroachievements/api";

import type { MappedCompleteGame } from "@achievements-app/data-access-common-models";

import { mapAchievementToMappedGameAchievement } from "./mapAchievementToMappedGameAchievement";

export const mapGameInfoExtendedToCompleteGame = (
  gameExtended: GameExtended
): MappedCompleteGame => {
  const flattenedAchievements: GameExtendedAchievementEntity[] = [];
  for (const achievement of Object.values(gameExtended.achievements)) {
    flattenedAchievements.push(achievement);
  }

  return {
    name: gameExtended.title as string,
    gamePlatforms: [gameExtended.consoleName as string],
    gamingService: "RA",
    serviceTitleId: String(gameExtended.id as number),
    knownPlayerCount: gameExtended.numDistinctPlayersHardcore,
    coverImageUrl: gameExtended.imageIcon
      ? `https://retroachievements.org${gameExtended.imageIcon}`
      : undefined,
    achievements: flattenedAchievements.map(
      mapAchievementToMappedGameAchievement
    )
  };
};
