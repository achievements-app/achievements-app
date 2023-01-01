import type {
  Game,
  GameAchievement,
  UserEarnedAchievement,
  UserGameProgress
} from "@achievements-app/data-access-db";

export type CompleteUserGameProgress = UserGameProgress & {
  game: Game & { achievements: GameAchievement[] };
  earnedAchievements: Array<
    UserEarnedAchievement & { achievement: GameAchievement }
  >;
};
