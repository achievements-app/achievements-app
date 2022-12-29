import type { MappedGame } from "@achievements-app/data-access-common-models";

import type { XboxSanitizedTitleHistoryEntity } from "../models";

export const mapTitleHistoryEntityToStoredGame = (
  titleHistoryEntity: XboxSanitizedTitleHistoryEntity
): MappedGame => {
  return {
    name: titleHistoryEntity.name,
    gamingService: "XBOX",
    serviceTitleId: String(titleHistoryEntity.titleId),
    xboxAchievementsSchemaKind: titleHistoryEntity.titleKind,
    knownUserEarnedPointsCount: titleHistoryEntity.totalUnlockedGamerscore
  };
};
