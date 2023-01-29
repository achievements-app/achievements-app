import type {
  GameExtendedAchievementEntity,
  GameExtendedAchievementEntityWithUserProgress
} from "@retroachievements/api";

import type { MappedGameAchievement } from "@achievements-app/data-access-common-models";

export const mapAchievementToMappedGameAchievement = (
  achievement:
    | GameExtendedAchievementEntity
    | GameExtendedAchievementEntityWithUserProgress
): MappedGameAchievement => {
  let earnedOn: string | undefined;
  if ("dateEarnedHardcore" in achievement && achievement?.dateEarnedHardcore) {
    earnedOn = achievement.dateEarnedHardcore;
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
