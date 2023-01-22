import { faker } from "@faker-js/faker";
import type { Achievement, GameInfoExtended } from "retroachievements-js";

import { generateRaAchievement } from "./generateRaAchievement";

export const generateRaGameInfoExtended = (
  gameInfoExtendedProps?: Partial<GameInfoExtended>,
  options?: Partial<{
    achievementCount: number;
    /** Sometimes we don't want to have achievements be worth 100 points under test. */
    achievementPoints: number;
  }>
): GameInfoExtended => {
  const generatedAchievements: Achievement[] = [];

  const achievementCount = options?.achievementCount ?? 10;
  for (let i = 0; i < achievementCount; i += 1) {
    generatedAchievements.push(
      generateRaAchievement({ id: i, points: options?.achievementPoints })
    );
  }

  return {
    title: faker.random.words(4),
    gameTitle: faker.random.words(4),
    consoleId: null,
    console: faker.random.word(),
    forumTopicId: null,
    consoleName: faker.random.word(),
    imageIcon: faker.random.word(),
    gameIcon: faker.random.word(),
    imageTitle: faker.random.word(),
    imageIngame: faker.random.word(),
    imageBoxArt: faker.random.word(),
    richPresencePatch: faker.datatype.uuid(),
    id: faker.datatype.number(100_000),
    isFinal: faker.datatype.boolean(),
    numDistinctPlayersCasual: faker.datatype.number(1000),
    numDistinctPlayersHardcore: faker.datatype.number(1000),
    achievements: generatedAchievements,
    ...gameInfoExtendedProps
  };
};
