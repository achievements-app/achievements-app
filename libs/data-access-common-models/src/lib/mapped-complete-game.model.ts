import type { MappedGame } from "./mapped-game.model";
import type { MappedGameAchievement } from "./mapped-game-achievement.model";

export type MappedCompleteGame = MappedGame & {
  achievements: MappedGameAchievement[];
};
