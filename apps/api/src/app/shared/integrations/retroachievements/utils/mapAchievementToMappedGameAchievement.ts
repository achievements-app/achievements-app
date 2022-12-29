import type { Achievement } from "retroachievements-js";

import type { MappedGameAchievement } from "@achievements-app/data-access-common-models";

export const mapAchievementToMappedGameAchievement = (
  achievement: Achievement
): MappedGameAchievement => {
  return {
    serviceAchievementId: String(achievement.id),
    name: achievement.title,
    description: String(achievement.description),
    vanillaPoints: achievement.points,
    ratioPoints: achievement.trueRatio,
    sourceImageUrl: `https://media.retroachievements.org/Badge/${achievement.badgeName}.png`,
    knownEarnerCount: achievement.numAwardedHardcore ?? 0,
    earnedOn: achievement?.dateEarnedHardcore?.toISOString() ?? undefined
  };
};
