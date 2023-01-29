import { faker } from "@faker-js/faker";
import type { GameExtendedAchievementEntityWithUserProgress } from "@retroachievements/api";

export const generateRaGameExtendedAchievementEntityWithUserProgress = (
  props?: Partial<GameExtendedAchievementEntityWithUserProgress>
): GameExtendedAchievementEntityWithUserProgress => {
  return {
    author: faker.random.words(2),
    badgeName: faker.random.word(),
    dateCreated: faker.date.past(1).toISOString(),
    dateEarned: faker.date.past(1).toISOString(),
    dateEarnedHardcore: faker.date.past(1).toISOString(),
    dateModified: faker.date.past(1).toISOString(),
    description: faker.random.words(8),
    displayOrder: faker.datatype.number(100),
    id: faker.datatype.number(1000),
    memAddr: faker.datatype.uuid(),
    numAwarded: faker.datatype.number(1000),
    numAwardedHardcore: faker.datatype.number(1000),
    points: faker.helpers.arrayElement([1, 2, 5, 10, 25, 50]),
    title: faker.random.words(3),
    trueRatio: faker.datatype.number(1000),
    ...props
  };
};
