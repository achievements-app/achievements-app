import { faker } from "@faker-js/faker";
import type {
  GameExtendedAchievementEntityWithUserProgress,
  GameInfoAndUserProgress
} from "@retroachievements/api";

import { convertAchievementsListToMap } from "./convertAchievementsListToMap";
import { generateRaGameExtendedAchievementEntityWithUserProgress } from "./generateRaGameExtendedAchievementWithUserProgress";

export const generateRaGameInfoAndUserProgress = (
  props?: Partial<GameInfoAndUserProgress>,
  options?: Partial<{
    earnedAchievementCount: number;
    /** Sometimes we don't want to have achievements be worth 100 points under test. */
    achievementPoints: number;
  }>
): GameInfoAndUserProgress => {
  const generatedAchievements: GameExtendedAchievementEntityWithUserProgress[] =
    [];

  const achievementCount = options?.earnedAchievementCount ?? 5;
  for (let i = 0; i < achievementCount; i += 1) {
    generatedAchievements.push(
      generateRaGameExtendedAchievementEntityWithUserProgress({
        id: i,
        points: options?.achievementPoints
        // a dateEarnedHardcore will automatically be generated marked this as earned
      })
    );
  }

  return {
    achievements:
      props.achievements ?? convertAchievementsListToMap(generatedAchievements),
    id: faker.datatype.number(100_000),
    title: faker.random.words(4),
    consoleId: faker.datatype.number(900),
    forumTopicId: faker.datatype.number(100_000),
    flags: faker.datatype.number(10),
    imageIcon: faker.random.word(),
    imageTitle: faker.random.word(),
    imageBoxArt: faker.random.word(),
    imageIngame: faker.random.word(),
    publisher: faker.random.words(3),
    developer: faker.random.words(3),
    genre: faker.random.word(),
    released: faker.date.past(30).getFullYear(),
    isFinal: faker.datatype.boolean(),
    consoleName: faker.random.word(),
    richPresencePatch: faker.datatype.uuid(),
    numAchievements: achievementCount,
    numDistinctPlayersCasual: faker.datatype.number(1000),
    numDistinctPlayersHardcore: faker.datatype.number(1000),
    numAwardedToUser: achievementCount,
    numAwardedToUserHardcore: achievementCount,
    userCompletion: `%${faker.datatype.number(100)}`,
    userCompletionHardcore: `%${faker.datatype.number(100)}`,
    claims: [],
    ...props
  };
};
