import { faker } from "@faker-js/faker";
import type { UserGameCompletion } from "retroachievements-js";

export const generateRaUserGameCompletion = (
  userGameCompletionProps?: Partial<UserGameCompletion>
): UserGameCompletion => {
  return {
    gameId: faker.datatype.number(100_000),
    consoleName: faker.random.word(),
    imageIcon: faker.internet.url(),
    title: faker.random.words(3),
    numAwarded: faker.datatype.number(1000),
    maxPossible: faker.datatype.number(1000),
    pctWon: faker.datatype.number(100),
    "max(awHardcoreMode)": 1,
    consoleId: faker.datatype.number(100),
    numAwardedHc: faker.datatype.number(1000),
    pctWonHc: faker.datatype.number(100),
    ...userGameCompletionProps
  };
};
