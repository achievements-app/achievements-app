import { faker } from "@faker-js/faker";
import type {
  GameExtended,
  GameExtendedAchievementEntity
} from "@retroachievements/api";

import { convertAchievementsListToMap } from "./convertAchievementsListToMap";
import { generateRaGameExtendedAchievementEntity } from "./generateRaGameExtendedAchievementEntity";

export const generateRaGameExtended = (
  gameExtendedProps?: Partial<GameExtended>,
  options?: Partial<{
    achievementCount: number;
    /** Sometimes we don't want to have achievements be worth 100 points under test. */
    achievementPoints: number;
  }>
): GameExtended => {
  const generatedAchievements: GameExtendedAchievementEntity[] = [];

  const achievementCount = options?.achievementCount ?? 10;
  for (let i = 0; i < achievementCount; i += 1) {
    generatedAchievements.push(
      generateRaGameExtendedAchievementEntity({
        id: i,
        points: options?.achievementPoints
      })
    );
  }

  return {
    title: faker.random.words(4),
    consoleId: null,
    forumTopicId: null,
    flags: 0,
    publisher: faker.random.words(2),
    developer: faker.random.words(2),
    genre: faker.random.word(),
    released: 1980,
    numAchievements: generatedAchievements.length,
    claims: [],
    consoleName: faker.random.word(),
    imageIcon: faker.random.word(),
    imageTitle: faker.random.word(),
    imageIngame: faker.random.word(),
    imageBoxArt: faker.random.word(),
    richPresencePatch: faker.datatype.uuid(),
    id: faker.datatype.number(100_000),
    isFinal: faker.datatype.boolean(),
    numDistinctPlayersCasual: faker.datatype.number(1000),
    numDistinctPlayersHardcore: faker.datatype.number(1000),
    achievements: convertAchievementsListToMap(generatedAchievements),
    ...gameExtendedProps
  };
};
