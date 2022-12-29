import { faker } from "@faker-js/faker";

import type { MappedGame } from "@achievements-app/data-access-common-models";

export const generateMappedGame = (
  mappedGameProps?: Partial<MappedGame>
): MappedGame => {
  return {
    gamingService: faker.helpers.arrayElement(["RA", "XBOX", "PSN"]),
    name: faker.commerce.productName(),
    serviceTitleId: faker.datatype.uuid(),
    gamePlatforms: [faker.random.word()],
    knownPlayerCount: faker.datatype.number(10000),
    knownUserEarnedAchievementCount: faker.datatype.number(1000),
    knownUserEarnedPointsCount: faker.datatype.number(100),
    xboxAchievementsSchemaKind: faker.helpers.arrayElement([
      "legacy",
      "modern"
    ]),
    ...mappedGameProps
  };
};
