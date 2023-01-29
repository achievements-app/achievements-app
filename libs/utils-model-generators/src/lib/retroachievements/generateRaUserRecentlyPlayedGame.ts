import { faker } from "@faker-js/faker";
import type { UserRecentlyPlayedGameEntity } from "@retroachievements/api";

export const generateRaUserRecentlyPlayedGame = (
  userRecentlyPlayedGameEntityProps?: Partial<UserRecentlyPlayedGameEntity>
): UserRecentlyPlayedGameEntity => {
  return {
    consoleId: faker.datatype.number(100),
    consoleName: faker.random.word(),
    gameId: faker.datatype.number(100_000),
    imageIcon: faker.internet.url(),
    lastPlayed: faker.date.past(1).toISOString(),
    // myVote: faker.datatype.number(5),
    numAchieved: faker.datatype.number(100),
    numAchievedHardcore: faker.datatype.number(100),
    numPossibleAchievements: faker.datatype.number(100),
    possibleScore: faker.datatype.number(1000),
    scoreAchieved: faker.datatype.number(1000),
    scoreAchievedHardcore: faker.datatype.number(1000) as any,
    title: faker.random.words(3),
    ...userRecentlyPlayedGameEntityProps
  };
};
