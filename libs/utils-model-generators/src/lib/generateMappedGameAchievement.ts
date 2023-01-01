import { faker } from "@faker-js/faker";

import type { MappedGameAchievement } from "@achievements-app/data-access-common-models";

export const generateMappedGameAchievement = (
  mappedGameAchievementProps?: Partial<MappedGameAchievement>
): MappedGameAchievement => {
  return {
    name: faker.commerce.productName(),
    description: faker.random.words(10),
    earnedOn: faker.date.past(1).toISOString(),
    serviceAchievementId: faker.datatype.uuid(),
    knownEarnerCount: faker.datatype.number(10000),
    knownEarnerPercentage: faker.datatype.number(100),
    ratioPoints: faker.datatype.number(5000),
    vanillaPoints: faker.helpers.arrayElement([1, 2, 5, 10, 20, 25, 50, 100]),
    psnGroupId: faker.random.word(),
    isEarned: faker.datatype.boolean(),
    psnTrophyKind: faker.helpers.arrayElement([
      "Bronze",
      "Silver",
      "Gold",
      "Platinum"
    ]),
    sourceImageUrl: faker.internet.url(),
    ...mappedGameAchievementProps
  };
};
