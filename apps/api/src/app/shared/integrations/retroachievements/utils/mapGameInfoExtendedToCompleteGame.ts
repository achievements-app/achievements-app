import type { GameInfoExtended } from "retroachievements-js";

import type { MappedCompleteGame } from "@achievements-app/data-access-common-models";

import { mapAchievementToMappedGameAchievement } from "./mapAchievementToMappedGameAchievement";

export const mapGameInfoExtendedToCompleteGame = (
  gameInfoExtended: GameInfoExtended & { titleCompletionRate: number | null }
): MappedCompleteGame => {
  return {
    name: gameInfoExtended.title as string,
    gamePlatforms: [gameInfoExtended.consoleName as string],
    gamingService: "RA",
    serviceTitleId: String(gameInfoExtended.id as number),
    knownCompletionistRate: gameInfoExtended.titleCompletionRate ?? undefined,
    knownPlayerCount: gameInfoExtended.numDistinctPlayersHardcore,
    coverImageUrl: gameInfoExtended.imageIcon
      ? `https://retroachievements.org${gameInfoExtended.imageIcon}`
      : undefined,
    achievements: gameInfoExtended.achievements.map(
      mapAchievementToMappedGameAchievement
    )
  };
};
