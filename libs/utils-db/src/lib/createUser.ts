import { faker } from "@faker-js/faker";

import { type User, db } from "@achievements-app/data-access-db";

export const createUser = (userProps?: Partial<User>) => {
  return db.user.create({
    data: {
      userName: faker.internet.userName(),
      ...userProps
    }
  });
};
