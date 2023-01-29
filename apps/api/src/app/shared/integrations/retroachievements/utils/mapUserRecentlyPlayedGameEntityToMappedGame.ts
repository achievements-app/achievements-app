import type { UserRecentlyPlayedGameEntity } from "@retroachievements/api";

import type { MappedGame } from "@achievements-app/data-access-common-models";

export const mapUserRecentlyPlayedGameEntityToMappedGame = (
  userRecentlyPlayedGame: UserRecentlyPlayedGameEntity
): MappedGame => {
  return {
    name: userRecentlyPlayedGame.title,
    gamingService: "RA",
    serviceTitleId: String(userRecentlyPlayedGame.gameId),
    gamePlatforms: [userRecentlyPlayedGame.consoleName],
    knownUserEarnedAchievementCount: userRecentlyPlayedGame.numAchievedHardcore
  };
};
