import { faker } from "@faker-js/faker";

import db, { type Game, GamingService } from "../index";

export const addGame = async (
  achievementCount = 0,
  gameProps?: Partial<Game>
) => {
  return await db.game.create({
    data: {
      name: faker.random.words(3),
      serviceTitleId: faker.random.numeric(8),
      gamingService: faker.helpers.arrayElement(
        Object.keys(GamingService) as any
      ),
      achievements: {
        createMany: {
          data: [
            ...Array.from({ length: achievementCount }).map(() => ({
              name: faker.random.words(3),
              serviceAchievementId: faker.random.numeric(8),
              description: faker.random.words(8),
              knownEarnerCount: faker.datatype.number(1000),
              vanillaPoints: faker.helpers.arrayElement([
                1, 2, 5, 10, 20, 25, 50, 100
              ])
            }))
          ]
        }
      },
      ...gameProps
    },
    include: {
      achievements: true
    }
  });
};
