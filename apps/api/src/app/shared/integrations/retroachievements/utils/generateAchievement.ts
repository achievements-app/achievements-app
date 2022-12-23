import { faker } from "@faker-js/faker";
import type { Achievement } from "retroachievements-js";
import type { PartialDeep } from "type-fest";

export const generateAchievement = (
  achievementProps?: PartialDeep<Achievement>
): Achievement => {
  return {
    id: faker.datatype.number(100000),
    numAwarded: faker.datatype.number(1000),
    numAwardedHardcore: faker.datatype.number(1000),
    title: faker.random.words(3),
    description: faker.random.words(8),
    points: faker.helpers.arrayElement([1, 2, 5, 10, 20, 25, 50, 100]),
    trueRatio: faker.datatype.number(500),
    author: faker.internet.userName(),
    dateModified: faker.date.recent(),
    dateCreated: faker.date.recent(),
    badgeName: faker.datatype.number(100000),
    displayOrder: faker.datatype.number(1000),
    memAddr: faker.datatype.uuid(),
    gameId: faker.datatype.number(100000),
    gameTitle: faker.random.words(3),
    isAwarded: faker.helpers.arrayElement([0, 1]),
    dateAwarded: faker.date.recent(),
    dateEarned: faker.date.recent(),
    dateEarnedHardcore: faker.date.recent(),
    hardcoreAchieved: faker.datatype.number(500),
    ...achievementProps
  };
};
