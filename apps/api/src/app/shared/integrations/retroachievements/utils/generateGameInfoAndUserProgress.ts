import { faker } from "@faker-js/faker";
import type { GameInfoAndUserProgress } from "retroachievements-js";
import type { PartialDeep } from "type-fest";

import { generateAchievement } from "./generateAchievement";

export const generateGameInfoAndUserProgress = (
  gameInfoAndUserProgressProps?: PartialDeep<GameInfoAndUserProgress>,
  options?: Partial<{
    earnedAchievementIds: number[];
    unearnedAchievementIds: number[];
  }>
): GameInfoAndUserProgress => {
  const achievements = [];

  if (options?.earnedAchievementIds) {
    for (const id of options.earnedAchievementIds) {
      achievements.push(generateAchievement({ id }));
    }
  }

  if (options?.unearnedAchievementIds) {
    for (const id of options.unearnedAchievementIds) {
      achievements.push(
        generateAchievement({
          id,
          dateEarned: undefined,
          dateAwarded: undefined,
          dateEarnedHardcore: undefined,
          isAwarded: 0
        })
      );
    }
  }

  return {
    achievements,
    id: faker.datatype.number(100000),
    title: faker.random.words(3),
    consoleId: faker.datatype.number(100),
    forumTopicId: faker.datatype.number(100),
    flags: faker.datatype.number(100),
    imageIcon: faker.internet.url(),
    imageTitle: faker.internet.url(),
    imageIngame: faker.internet.url(),
    publisher: faker.company.name(),
    developer: faker.company.name(),
    genre: faker.music.genre(),
    released: faker.date.past(20),
    isFinal: faker.datatype.boolean(),
    consoleName: faker.random.word(),
    richPresencePatch: faker.git.commitSha(),
    numDistinctPlayersCasual: faker.datatype.number(10000),
    numDistinctPlayersHardcore: faker.datatype.number(10000),
    numAwardedToUser: faker.datatype.number(10),
    numAwardedToUserHardcore: faker.datatype.number(10),
    userCompletionHardcore: faker.datatype.number(100),
    userCompletion: faker.datatype.number(100),
    numAchievements: faker.datatype.number(100),
    ...gameInfoAndUserProgressProps
  };
};
