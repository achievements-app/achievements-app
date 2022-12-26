// This is derived from XboxLegacyTitleHistoryEntity and XboxModernTitleHistoryEntity.
// Ideally, both types will converge or be mapped onto this single unified type.

export interface XboxSanitizedTitleHistoryEntity {
  name: string;
  platforms: string[];
  titleId: number;
  totalPossibleGamerscore: number;
  totalUnlockedGamerscore: number;
}
