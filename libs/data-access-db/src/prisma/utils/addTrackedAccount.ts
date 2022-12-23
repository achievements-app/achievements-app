import { faker } from "@faker-js/faker";
import type { PartialDeep } from "type-fest";

import db, { type TrackedAccount, GamingService } from "../index";

export const addTrackedAccount = async (
  trackedAccountProps?: PartialDeep<TrackedAccount>
) => {
  return await db.trackedAccount.create({
    data: {
      accountUserName: faker.internet.userName(),
      gamingService: faker.helpers.arrayElement(
        Object.keys(GamingService) as any
      ),
      userId: faker.datatype.uuid(),
      ...trackedAccountProps
    }
  });
};
