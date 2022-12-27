import type { XboxSanitizedAchievementEntity } from "./xbox-sanitized-achievement-entity.model";
import type { XboxTitleMetadata } from "./xbox-title-metadata.model";

export type XboxDeepGameInfo = XboxTitleMetadata & {
  achievements: XboxSanitizedAchievementEntity[];
  achievementsSchemaKind: "legacy" | "modern";
};
