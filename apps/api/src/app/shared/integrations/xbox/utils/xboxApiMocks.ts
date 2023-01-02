import { faker } from "@faker-js/faker";

import {
  XboxDeepGameInfo,
  XboxLegacyAchievementEntity,
  XboxLegacyTitleHistoryEntity,
  XboxModernAchievementEntity,
  XboxModernTitleHistoryEntity,
  XboxSanitizedAchievementEntity,
  XboxSanitizedTitleHistoryEntity,
  XboxTitleMetadata
} from "../models";

export const generateXboxSanitizedAchievementEntity = (
  xboxSanitizedAchievementEntityProps?: Partial<XboxSanitizedAchievementEntity>
): XboxSanitizedAchievementEntity => {
  return {
    description: faker.random.words(8),
    gamerscore: faker.helpers.arrayElement([5, 10, 15, 20, 25, 50, 100]),
    id: faker.datatype.uuid(),
    imageUrl: faker.internet.url(),
    name: faker.random.words(4),
    rarityPercentage: faker.datatype.number(100),
    ...xboxSanitizedAchievementEntityProps
  };
};

export const generateXboxDeepGameInfo = (
  xboxDeepGameInfoProps?: Partial<XboxDeepGameInfo>,
  options?: Partial<{ achievementCount: number }>
): XboxDeepGameInfo => {
  const generatedAchievements: XboxSanitizedAchievementEntity[] = [];

  const achievementCount = options?.achievementCount ?? 10;
  for (let i = 0; i < achievementCount; i += 1) {
    generatedAchievements.push(
      generateXboxSanitizedAchievementEntity({ id: String(i) })
    );
  }

  return {
    achievementsSchemaKind: faker.helpers.arrayElement(["legacy", "modern"]),
    ...generateXboxTitleMetadata(),
    achievements: generatedAchievements,
    ...xboxDeepGameInfoProps
  };
};

export const generateXboxSanitizedTitleHistoryEntity = (
  xboxSanitizedTitleHistoryEntityProps?: Partial<XboxSanitizedTitleHistoryEntity>
): XboxSanitizedTitleHistoryEntity => {
  return {
    name: faker.random.words(4),
    titleId: faker.datatype.number(100_000),
    titleKind: faker.helpers.arrayElement(["legacy", "modern"]),
    totalPossibleGamerscore: faker.datatype.number(1000),
    totalUnlockedGamerscore: faker.datatype.number(1000),
    ...xboxSanitizedTitleHistoryEntityProps
  };
};

export const generateXboxLegacyTitleHistoryEntity = (
  xboxLegacyTitleHistoryEntityProps?: Partial<XboxLegacyTitleHistoryEntity>
): XboxLegacyTitleHistoryEntity => {
  return {
    currentAchievements: faker.datatype.number(100),
    currentGamerscore: faker.datatype.number(1000),
    lastPlayed: faker.date.past().toISOString(),
    name: faker.random.words(8),
    platforms: [],
    sequence: faker.datatype.number(100),
    titleId: faker.datatype.number(100_000),
    titleType: faker.datatype.number(10),
    totalAchievements: faker.datatype.number(100),
    totalGamerscore: faker.datatype.number(1000),
    ...xboxLegacyTitleHistoryEntityProps
  };
};

export const generateXboxModernTitleHistoryEntity = (
  xboxModernTitleHistoryEntityProps?: Partial<XboxModernTitleHistoryEntity>
): XboxModernTitleHistoryEntity => {
  return {
    currentGamerscore: faker.datatype.number(1000),
    earnedAchievements: faker.datatype.number(100),
    lastUnlock: faker.date.past().toISOString(),
    maxGamerscore: faker.datatype.number(1000),
    name: faker.random.words(8),
    platform: faker.random.word(),
    serviceConfigId: faker.datatype.uuid(),
    titleId: faker.datatype.number(100_000),
    titleType: faker.random.word(),
    ...xboxModernTitleHistoryEntityProps
  };
};

export const generateXboxTitleMetadata = (
  xboxTitleMetadataProps?: Partial<XboxTitleMetadata>
): XboxTitleMetadata => {
  return {
    titleId: faker.random.numeric(5),
    pfn: faker.datatype.uuid(),
    bingId: faker.datatype.uuid(),
    windowsPhoneProductId: faker.datatype.uuid(),
    name: faker.random.words(3),
    type: faker.random.word(),
    devices: faker.helpers.arrayElements([
      "PC",
      "XboxOne",
      "XboxSeries",
      "Xbox360"
    ]),
    displayImage: faker.internet.url(),
    mediaItemType: faker.random.word(),
    modernTitleId: faker.datatype.uuid(),
    isBundle: faker.datatype.boolean(),
    xboxLiveTier: faker.random.word(),
    stats: null,
    gamePass: null,
    titleHistory: null,
    titleRecord: null,
    detail: null,
    friendsWhoPlayed: null,
    alternateTitleIds: null,
    contentBoards: null,
    achievement: {
      currentAchievements: faker.datatype.number(100),
      totalAchievements: faker.datatype.number(100),
      currentGamerscore: faker.datatype.number(1000),
      totalGamerscore: faker.datatype.number(1000),
      progressPercentage: faker.datatype.number(100),
      sourceVersion: faker.datatype.number(5)
    },
    images: [],
    ...xboxTitleMetadataProps
  };
};

export const generateXboxLegacyAchievementEntity = (
  xboxLegacyAchievementEntityProps?: Partial<XboxLegacyAchievementEntity>
): XboxLegacyAchievementEntity => {
  return {
    description: faker.random.words(8),
    flags: faker.datatype.number(10),
    gamerscore: faker.helpers.arrayElement([5, 10, 25, 50, 100]),
    id: faker.datatype.number(1000),
    imageId: faker.datatype.number(1000),
    isRevoked: faker.datatype.boolean(),
    isSecret: faker.datatype.boolean(),
    lockedDescription: faker.random.words(8),
    name: faker.random.words(8),
    platform: faker.datatype.number(10),
    sequence: faker.datatype.number(100),
    timeUnlocked: faker.date.past().toISOString(),
    titleId: faker.datatype.number(100_000),
    type: faker.datatype.number(100),
    unlocked: faker.datatype.boolean(),
    unlockedOnline: faker.datatype.boolean(),
    rarity: {
      currentCategory: faker.random.word(),
      currentPercentage: faker.datatype.number(100)
    },
    ...xboxLegacyAchievementEntityProps
  };
};

export const generateXboxModernAchievementEntity = (
  xboxModernAchievementEntityProps?: Partial<XboxModernAchievementEntity>
): XboxModernAchievementEntity => {
  return {
    id: faker.datatype.uuid(),
    serviceConfigId: faker.datatype.uuid(),
    name: faker.random.words(3),
    titleAssociations: [],
    progressState: faker.helpers.arrayElement(["NotStarted", "Achieved"]),
    progression: {
      timeUnlocked: faker.date.past(1).toISOString(),
      requirements: []
    },
    mediaAssets: [{ type: "Icon", name: "Icon", url: faker.internet.url() }],
    platforms: [],
    isSecret: faker.datatype.boolean(),
    description: faker.random.words(8),
    lockedDescription: faker.random.words(8),
    productId: faker.datatype.uuid(),
    achievementType: faker.random.word(),
    participationType: faker.random.word(),
    timeWindow: null,
    rewards: [
      {
        type: "Gamerscore",
        value: String(faker.helpers.arrayElement([5, 10, 20, 25, 50, 100])),
        description: faker.random.words(8),
        name: faker.random.word(),
        valueType: faker.random.word(),
        mediaAsset: null
      }
    ],
    estimatedTime: faker.random.word(),
    deeplink: faker.internet.url(),
    isRevoked: faker.datatype.boolean(),
    rarity: {
      currentCategory: faker.random.word(),
      currentPercentage: faker.datatype.number(100)
    },
    ...xboxModernAchievementEntityProps
  };
};
