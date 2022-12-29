import type { GameAchievement } from "@achievements-app/data-access-db";

type MappedGameAchievementRequiredProps = Pick<
  GameAchievement,
  "serviceAchievementId" | "name" | "description"
>;

type MappedGameAchievementOptionalProps = Partial<
  Pick<
    GameAchievement,
    | "vanillaPoints"
    | "ratioPoints"
    | "sourceImageUrl"
    | "knownEarnerCount"
    | "knownEarnerPercentage"
  > & { earnedOn: string }
>;

export type MappedGameAchievement = MappedGameAchievementRequiredProps &
  MappedGameAchievementOptionalProps;
