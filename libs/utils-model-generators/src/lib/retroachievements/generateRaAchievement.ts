import { faker } from "@faker-js/faker";
import type { Achievement } from "retroachievements-js";

export const generateRaAchievement = (
  achievementProps?: Partial<Achievement>,
  options?: Partial<{ isEarned: boolean }>
): Achievement => {
  const earnedProps = options?.isEarned
    ? {
        isAwarded: 1,
        dateAwarded: faker.date.recent(),
        dateEarned: faker.date.recent(),
        dateEarnedHardcore: faker.date.recent(),
        hardcoreAchieved: 1
      }
    : {};

  return {
    id: faker.datatype.number(100_000),
    numAwarded: faker.datatype.number(1000),
    numAwardedHardcore: faker.datatype.number(1000),
    title: faker.random.words(3),
    description: faker.random.words(10),
    points: faker.datatype.number(100),
    trueRatio: faker.datatype.number(1000),
    author: faker.internet.userName(),
    dateModified: faker.date.recent(),
    dateCreated: faker.date.recent(),
    badgeName: faker.datatype.number(1000),
    displayOrder: faker.datatype.number(1000),
    memAddr: faker.datatype.uuid(),
    isAwarded: 0,
    ...earnedProps,
    ...achievementProps
  };
};
