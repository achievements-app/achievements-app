// This is derived from XboxLegacyTitleHistoryEntity and XboxModernTitleHistoryEntity.
// Ideally, both types will converge or be mapped onto this single unified type.

export interface XboxSanitizedTitleHistoryEntity {
  name: string;
  titleId: number;
  titleKind: "legacy" | "modern";
  totalPossibleGamerscore: number;
  totalUnlockedGamerscore: number;
}
