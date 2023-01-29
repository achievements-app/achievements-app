import type { UserCompletedGame } from "@retroachievements/api";

import type { MappedGame } from "@achievements-app/data-access-common-models";

export const mapUserGameCompletionToStoredGame = (
  userGameCompletion: UserCompletedGame
): MappedGame => {
  return {
    name: userGameCompletion.title,
    gamingService: "RA",
    serviceTitleId: String(userGameCompletion.gameId),
    gamePlatforms: [userGameCompletion.consoleName],
    knownUserEarnedAchievementCount: userGameCompletion.numAwarded ?? 0
  };
};
