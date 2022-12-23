import { faker } from "@faker-js/faker";

import db from "../index";

export const addRandomUser = async () => {
  return await db.user.create({
    data: {
      userName: faker.internet.userName()
    }
  });
};
