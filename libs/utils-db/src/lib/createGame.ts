import { faker } from "@faker-js/faker";

import { type Game, db } from "@achievements-app/data-access-db";

export const createGame = (gameProps?: Partial<Game>) => {
  return db.game.create({
    data: {
      gamingService: faker.helpers.arrayElement(["RA", "XBOX", "PSN"]),
      name: faker.commerce.productName(),
      serviceTitleId: faker.random.numeric(100000),
      isStale: false,
      ...gameProps
    }
  });
};
