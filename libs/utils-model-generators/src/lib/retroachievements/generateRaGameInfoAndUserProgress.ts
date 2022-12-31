import { faker } from "@faker-js/faker";
import type {
  Achievement,
  GameInfoAndUserProgress
} from "retroachievements-js";

import { generateRaAchievement } from "./generateRaAchievement";

export const generateRaGameInfoAndUserProgress = (
  gameInfoAndUserProgressProps?: Partial<GameInfoAndUserProgress>,
  options?: Partial<{ earnedAchievementCount: number }>
): GameInfoAndUserProgress => {
  const generatedAchievements: Achievement[] = [];

  const achievementCount = options?.earnedAchievementCount ?? 5;
  for (let i = 0; i < achievementCount; i += 1) {
    generatedAchievements.push(
      generateRaAchievement({ id: i }, { isEarned: true })
    );
  }

  return {
    id: faker.datatype.number(100_000),
    title: faker.random.words(4),
    consoleId: faker.datatype.number(900),
    forumTopicId: faker.datatype.number(100_000),
    flags: faker.datatype.number(10),
    imageIcon: faker.random.word(),
    imageTitle: faker.random.word(),
    imageIngame: faker.random.word(),
    publisher: faker.random.words(3),
    developer: faker.random.words(3),
    genre: faker.random.word(),
    released: faker.date.past(30),
    isFinal: faker.datatype.boolean(),
    consoleName: faker.random.word(),
    richPresencePatch: faker.datatype.uuid(),
    numAchievements: achievementCount,
    numDistinctPlayersCasual: faker.datatype.number(1000),
    numDistinctPlayersHardcore: faker.datatype.number(1000),
    numAwardedToUser: achievementCount,
    numAwardedToUserHardcore: achievementCount,
    userCompletion: faker.datatype.number(100),
    userCompletionHardcore: faker.datatype.number(100),
    achievements: generatedAchievements,
    ...gameInfoAndUserProgressProps
  };
};
