import type { GameInfoExtended } from "retroachievements-js";

import type { MappedCompleteGame } from "@achievements-app/data-access-common-models";

import { mapAchievementToMappedGameAchievement } from "./mapAchievementToMappedGameAchievement";

export const mapGameInfoExtendedToCompleteGame = (
  gameInfoExtended: GameInfoExtended
): MappedCompleteGame => {
  return {
    name: gameInfoExtended.title as string,
    gamePlatforms: [gameInfoExtended.consoleName as string],
    gamingService: "RA",
    serviceTitleId: String(gameInfoExtended.id as number),
    achievements: gameInfoExtended.achievements.map(
      mapAchievementToMappedGameAchievement
    )
  };
};
