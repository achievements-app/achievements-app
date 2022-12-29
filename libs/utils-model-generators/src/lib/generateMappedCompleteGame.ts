import type {
  MappedCompleteGame,
  MappedGameAchievement
} from "@achievements-app/data-access-common-models";

import { generateMappedGame } from "./generateMappedGame";
import { generateMappedGameAchievement } from "./generateMappedGameAchievement";

export const generateMappedCompleteGame = (
  mappedCompleteGameProps?: Partial<MappedCompleteGame>,
  options?: Partial<{ achievementCount: number }>
): MappedCompleteGame => {
  const generatedAchievements: MappedGameAchievement[] = [];

  const achievementCount = options?.achievementCount ?? 5;
  for (let i = 0; i < achievementCount; i += 1) {
    generatedAchievements.push(generateMappedGameAchievement());
  }

  return {
    ...generateMappedGame(),
    achievements: generatedAchievements,
    ...mappedCompleteGameProps
  };
};
