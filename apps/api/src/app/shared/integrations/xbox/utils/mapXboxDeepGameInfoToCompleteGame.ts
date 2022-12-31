import type { MappedCompleteGame } from "@achievements-app/data-access-common-models";

import type { XboxDeepGameInfo } from "../models";
import { mapXboxAchievementToMappedGameAchievement } from "./mapXboxAchievementToMappedGameAchievement";

export const mapXboxDeepGameInfoToCompleteGame = (
  xboxDeepGameInfo: XboxDeepGameInfo,
  schemaKind: "legacy" | "modern"
): MappedCompleteGame => {
  return {
    name: xboxDeepGameInfo.name,
    gamePlatforms: xboxDeepGameInfo.devices,
    gamingService: "XBOX",
    serviceTitleId: xboxDeepGameInfo.titleId,
    xboxAchievementsSchemaKind: schemaKind,
    coverImageUrl: xboxDeepGameInfo.displayImage,
    achievements: xboxDeepGameInfo.achievements.map(
      mapXboxAchievementToMappedGameAchievement
    )
  };
};
