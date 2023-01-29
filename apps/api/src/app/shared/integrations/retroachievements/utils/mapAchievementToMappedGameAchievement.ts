import type { GameExtendedAchievementEntityWithUserProgress } from "@retroachievements/api";
import type { Achievement } from "retroachievements-js";

import type { MappedGameAchievement } from "@achievements-app/data-access-common-models";

export const mapAchievementToMappedGameAchievement = (
  achievement: Achievement | GameExtendedAchievementEntityWithUserProgress
): MappedGameAchievement => {
  let earnedOn: string | undefined;
  if (typeof achievement?.dateEarnedHardcore === "string") {
    earnedOn = achievement.dateEarnedHardcore;
  } else if (achievement?.dateEarnedHardcore) {
    earnedOn = achievement.dateEarnedHardcore.toISOString();
  }

  return {
    earnedOn,
    serviceAchievementId: String(achievement.id),
    name: achievement.title,
    description: String(achievement.description),
    vanillaPoints: achievement.points,
    ratioPoints: achievement.trueRatio,
    sourceImageUrl: `https://media.retroachievements.org/Badge/${achievement.badgeName}.png`,
    knownEarnerCount: achievement.numAwardedHardcore ?? 0,
    isEarned: earnedOn ? true : false
  };
};
