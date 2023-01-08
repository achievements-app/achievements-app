import type { Game } from "@achievements-app/data-access-db";

type MappedGameRequiredProps = Pick<
  Game,
  "name" | "gamingService" | "serviceTitleId"
>;

type MappedGameOptionalProps = Partial<
  Pick<
    Game,
    | "coverImageUrl"
    | "gamePlatforms"
    | "knownPlayerCount"
    | "xboxAchievementsSchemaKind"
    | "psnServiceName"
  > & {
    knownUserEarnedAchievementCount: number;
    knownUserEarnedPointsCount: number;
  }
>;

export type MappedGame = MappedGameRequiredProps & MappedGameOptionalProps;
