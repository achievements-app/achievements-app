import { faker } from "@faker-js/faker";

import { type User, db } from "@achievements-app/data-access-db";

export const createUser = (userProps?: Partial<User>) => {
  return db.user.create({
    include: { trackedAccounts: true },
    data: {
      userName: faker.internet.userName(),
      trackedAccounts: {
        createMany: {
          data: [
            {
              accountUserName: faker.internet.userName(),
              gamingService: "PSN"
            },
            {
              accountUserName: faker.internet.userName(),
              gamingService: "XBOX"
            },
            { accountUserName: faker.internet.userName(), gamingService: "RA" }
          ]
        }
      },
      ...userProps
    }
  });
};
