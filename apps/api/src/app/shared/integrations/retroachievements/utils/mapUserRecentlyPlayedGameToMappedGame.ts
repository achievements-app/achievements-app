import { UserRecentlyPlayedGame } from "retroachievements-js";

import type { MappedGame } from "@achievements-app/data-access-common-models";

export const mapUserRecentlyPlayedGameToMappedGame = (
  userRecentlyPlayedGame: UserRecentlyPlayedGame
): MappedGame => {
  return {
    name: userRecentlyPlayedGame.title,
    gamingService: "RA",
    serviceTitleId: String(userRecentlyPlayedGame.gameId),
    gamePlatforms: [userRecentlyPlayedGame.consoleName],
    knownUserEarnedAchievementCount: userRecentlyPlayedGame.numAchievedHardcore
  };
};
