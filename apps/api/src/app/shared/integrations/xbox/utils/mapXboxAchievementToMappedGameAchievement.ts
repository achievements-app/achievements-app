import type { MappedGameAchievement } from "@achievements-app/data-access-common-models";

import type { XboxSanitizedAchievementEntity } from "../models";

export const mapXboxAchievementToMappedGameAchievement = (
  xboxAchievement: XboxSanitizedAchievementEntity
): MappedGameAchievement => {
  return {
    serviceAchievementId: xboxAchievement.id,
    name: xboxAchievement.name,
    description: xboxAchievement.description,
    vanillaPoints: xboxAchievement.gamerscore,
    sourceImageUrl: xboxAchievement.imageUrl,
    knownEarnerPercentage: xboxAchievement.rarityPercentage,
    earnedOn: xboxAchievement?.timeUnlocked
  };
};
