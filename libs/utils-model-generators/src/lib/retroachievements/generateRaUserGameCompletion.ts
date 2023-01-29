import { faker } from "@faker-js/faker";
import type { UserCompletedGame } from "@retroachievements/api";

export const generateRaUserGameCompletion = (
  userGameCompletionProps?: Partial<UserCompletedGame>
): UserCompletedGame => {
  return {
    gameId: faker.datatype.number(100_000),
    consoleName: faker.random.word(),
    imageIcon: faker.internet.url(),
    title: faker.random.words(3),
    numAwarded: faker.datatype.number(1000),
    maxPossible: faker.datatype.number(1000),
    pctWon: faker.datatype.number(100),
    hardcoreMode: true,
    consoleId: faker.datatype.number(100),
    ...userGameCompletionProps
  };
};
