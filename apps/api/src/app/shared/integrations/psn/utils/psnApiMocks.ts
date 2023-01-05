import { faker } from "@faker-js/faker";
import type {
  TitleThinTrophy,
  TitleTrophiesResponse,
  TrophyTitle,
  UserThinTrophy,
  UserTitlesResponse,
  UserTrophiesEarnedForTitleResponse
} from "psn-api";

export const generateTitleThinTrophy = (
  titleThinTrophyProps?: Partial<TitleThinTrophy>
): TitleThinTrophy => {
  return {
    trophyId: faker.datatype.number(1000),
    trophyHidden: faker.datatype.boolean(),
    trophyType: faker.helpers.arrayElement([
      "bronze",
      "silver",
      "gold",
      "platinum"
    ]),
    trophyName: faker.random.words(4),
    trophyDetail: faker.random.words(9),
    trophyIconUrl: faker.internet.url(),
    trophyGroupId: faker.helpers.arrayElement([
      "default",
      "one",
      "two",
      "three"
    ]),
    ...titleThinTrophyProps
  };
};

export const generateTitleTrophiesResponse = (
  titleTrophiesResponseProps?: Partial<TitleTrophiesResponse>
): TitleTrophiesResponse => {
  return {
    trophySetVersion: "1",
    hasTrophyGroups: faker.datatype.boolean(),
    trophies: [
      generateTitleThinTrophy({ trophyId: 0 }),
      generateTitleThinTrophy({ trophyId: 1 }),
      generateTitleThinTrophy({ trophyId: 2 })
    ],
    totalItemCount: 3,
    ...titleTrophiesResponseProps
  };
};

export const generateTrophyTitle = (
  trophyTitleProps?: Partial<TrophyTitle>
): TrophyTitle => {
  return {
    npServiceName: faker.helpers.arrayElement(["trophy", "trophy2"]),
    npCommunicationId: faker.datatype.uuid(),
    trophySetVersion: faker.random.numeric(1),
    trophyTitleName: faker.random.words(4),
    trophyTitleIconUrl: faker.internet.url(),
    trophyTitlePlatform: faker.helpers.arrayElement(["PS4", "PS5", "PSVITA"]),
    hasTrophyGroups: faker.datatype.boolean(),
    definedTrophies: {
      bronze: faker.datatype.number(10),
      silver: faker.datatype.number(10),
      gold: faker.datatype.number(10),
      platinum: faker.helpers.arrayElement([0, 1])
    },
    progress: faker.datatype.number(100),
    earnedTrophies: {
      bronze: faker.datatype.number(10),
      silver: faker.datatype.number(10),
      gold: faker.datatype.number(10),
      platinum: faker.helpers.arrayElement([0, 1])
    },
    hiddenFlag: faker.datatype.boolean(),
    lastUpdatedDateTime: faker.date.past(1).toISOString(),
    ...trophyTitleProps
  };
};

export const generateUserTitlesResponse = (
  userTitlesResponseProps?: Partial<UserTitlesResponse>,
  options?: Partial<{
    visibleTitleCount: number;
    hiddenTitleCount: number;
  }>
): UserTitlesResponse => {
  const generatedTrophyTitles: TrophyTitle[] = [];

  const visibleTitleCount = options?.visibleTitleCount ?? 5;
  for (let i = 0; i < visibleTitleCount; i += 1) {
    generatedTrophyTitles.push(
      generateTrophyTitle({ npCommunicationId: String(i), hiddenFlag: false })
    );
  }

  const hiddenTitleCount = options?.hiddenTitleCount ?? 0;
  for (let i = 0; i < hiddenTitleCount; i += 1) {
    generatedTrophyTitles.push(
      generateTrophyTitle({
        npCommunicationId: String(i + visibleTitleCount),
        hiddenFlag: true
      })
    );
  }

  return {
    trophyTitles: generatedTrophyTitles,
    totalItemCount: generatedTrophyTitles.length,
    ...userTitlesResponseProps
  };
};

export const generateUserThinTrophy = (
  userThinTrophyProps?: Partial<UserThinTrophy>,
  options?: Partial<{ isEarned: boolean }>
): UserThinTrophy => {
  return {
    trophyId: faker.datatype.number(1000),
    trophyHidden: faker.datatype.boolean(),

    earned: options?.isEarned ?? false,
    earnedDateTime: options?.isEarned
      ? faker.date.past(5).toISOString()
      : undefined,

    trophyType: faker.helpers.arrayElement([
      "bronze",
      "silver",
      "gold",
      "platinum"
    ]),
    trophyRare: faker.helpers.arrayElement([0, 1, 2, 3]),
    trophyEarnedRate: String(faker.datatype.number(100)),
    trophyRewardImageUrl: faker.internet.url(),
    ...userThinTrophyProps
  };
};

export const generateUserTrophiesEarnedForTitleResponse = (
  userTrophiesEarnedForTitleProps?: Partial<UserTrophiesEarnedForTitleResponse>,
  options?: Partial<{
    unearnedTrophyCount: number;
    earnedTrophyCount: number;
  }>
): UserTrophiesEarnedForTitleResponse => {
  const generatedTrophies: UserThinTrophy[] = [];

  const unearnedTrophyCount = options?.unearnedTrophyCount ?? 10;
  for (let i = 0; i < unearnedTrophyCount; i += 1) {
    generatedTrophies.push(generateUserThinTrophy({ trophyId: i }));
  }

  const earnedTrophyCount = options?.earnedTrophyCount ?? 0;
  for (let i = 0; i < earnedTrophyCount; i += 1) {
    generatedTrophies.push(
      generateUserThinTrophy(
        { trophyId: i + unearnedTrophyCount },
        { isEarned: true }
      )
    );
  }

  return {
    trophySetVersion: faker.random.numeric(1),
    hasTrophyGroups: faker.datatype.boolean(),
    lastUpdatedDateTime: faker.date.past(1).toISOString(),
    totalItemCount: 0,
    trophies: generatedTrophies,
    ...userTrophiesEarnedForTitleProps
  };
};
