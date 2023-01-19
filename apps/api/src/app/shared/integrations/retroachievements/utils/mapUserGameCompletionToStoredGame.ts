import { UserGameCompletion } from "retroachievements-js";

import type { MappedGame } from "@achievements-app/data-access-common-models";

export const mapUserGameCompletionToStoredGame = (
  userGameCompletion: UserGameCompletion
): MappedGame => {
  return {
    name: userGameCompletion.title,
    gamingService: "RA",
    serviceTitleId: String(userGameCompletion.gameId),
    gamePlatforms: [userGameCompletion.consoleName],
    knownUserEarnedAchievementCount: userGameCompletion.numAwarded ?? 0
  };
};
