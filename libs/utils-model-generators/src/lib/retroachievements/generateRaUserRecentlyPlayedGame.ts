import { faker } from "@faker-js/faker";
import type { UserRecentlyPlayedGame } from "retroachievements-js";

export const generateRaUserRecentlyPlayedGame = (
  userRecentlyPlayedGameProps?: Partial<UserRecentlyPlayedGame>
): UserRecentlyPlayedGame => {
  return {
    consoleId: faker.datatype.number(100),
    consoleName: faker.random.word(),
    gameId: faker.datatype.number(100_000),
    imageIcon: faker.internet.url(),
    lastPlayed: faker.date.past(1),
    myVote: faker.datatype.number(5),
    numAchieved: faker.datatype.number(100),
    numAchievedHardcore: faker.datatype.number(100),
    numPossibleAchievements: faker.datatype.number(100),
    possibleScore: faker.datatype.number(1000),
    scoreAchieved: faker.datatype.number(1000),
    scoreAchievedHardcore: faker.datatype.number(1000) as any,
    title: faker.random.words(3),
    ...userRecentlyPlayedGameProps
  };
};
