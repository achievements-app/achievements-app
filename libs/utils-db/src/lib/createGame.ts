import { faker } from "@faker-js/faker";

import { type Game, db } from "@achievements-app/data-access-db";

export const createGame = (gameProps?: Partial<Game>) => {
  return db.game.create({
    data: {
      gamingService: faker.helpers.arrayElement(["RA", "XBOX", "PSN"]),
      name: faker.commerce.productName(),
      serviceTitleId: faker.datatype.uuid(),
      isStale: false,
      ...gameProps
    }
  });
};
