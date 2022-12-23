import { faker } from "@faker-js/faker";
import type { UserGameCompletion } from "retroachievements-js";
import type { PartialDeep } from "type-fest";

export const generateUserGameCompletion = (
  userGameCompletionProps?: PartialDeep<UserGameCompletion>
): UserGameCompletion => {
  return {
    gameId: faker.datatype.number(100000),
    consoleName: faker.random.word(),
    imageIcon: faker.internet.url(),
    title: faker.random.word(),
    numAwarded: faker.datatype.number(1000),
    maxPossible: faker.datatype.number(1000),
    pctWon: faker.datatype.number(100),
    hardcoreMode: faker.helpers.arrayElement([0, 1]),
    ...userGameCompletionProps
  };
};
