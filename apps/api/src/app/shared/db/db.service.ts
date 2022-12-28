import {
  type INestApplication,
  Injectable,
  Logger,
  OnModuleInit
} from "@nestjs/common";
import type {
  GameAchievement,
  GamingService,
  PrismaPromise,
  TrackedAccount,
  UserGameProgress
} from "@prisma/client";

import { db } from "@achievements-app/data-access-db";

import type {
  MappedCompleteGame,
  MappedGameAchievement
} from "@/api/common/models";

@Injectable()
export class DbService implements OnModuleInit {
  db = db;
  #logger = new Logger(DbService.name);

  async onModuleInit() {
    await this.db.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    this.db.$on("beforeExit", async () => {
      await app.close();
    });
  }

  async addNewRetroachievementsUserGameProgress(
    storedGameId: string,
    trackedAccount: TrackedAccount,
    serviceEarnedAchievements: MappedGameAchievement[]
  ) {
    const allGameAchievements = await this.findAllStoredGameAchievements(
      storedGameId
    );

    return await this.db.userGameProgress.create({
      data: {
        gameId: storedGameId,
        trackedAccountId: trackedAccount.id,
        earnedAchievements: {
          createMany: {
            skipDuplicates: true,
            data: serviceEarnedAchievements.map((achievement) => {
              const storedGameAchievement = allGameAchievements.find(
                (gameAchievement) =>
                  gameAchievement.serviceAchievementId ===
                  achievement.serviceAchievementId
              );

              return {
                gameAchievementId: storedGameAchievement.id,
                // TODO: is this timezone okay?
                earnedOn: achievement.earnedOn
              };
            })
          }
        }
      }
    });
  }

  async addNewXboxUserGameProgress(
    storedGameId: string,
    trackedAccount: TrackedAccount,
    serviceUserGameProgress: MappedCompleteGame
  ) {
    const allGameAchievements = await this.findAllStoredGameAchievements(
      storedGameId
    );

    return await this.db.userGameProgress.create({
      data: {
        gameId: storedGameId,
        trackedAccountId: trackedAccount.id,
        earnedAchievements: {
          createMany: {
            skipDuplicates: true,
            data: serviceUserGameProgress.achievements
              .filter((achievement) => achievement.earnedOn)
              .map((achievement) => {
                const foundStoredGameAchievement = allGameAchievements.find(
                  (gameAchievement) =>
                    gameAchievement.serviceAchievementId ===
                    achievement.serviceAchievementId
                );

                // If we fall into this block, the function will almost certainly fail.
                // We need to mark the game as stale.
                if (!foundStoredGameAchievement) {
                  this.markGameAsStale(storedGameId);
                }

                return {
                  gameAchievementId: foundStoredGameAchievement.id,
                  earnedOn: achievement.earnedOn
                };
              })
          }
        }
      }
    });
  }

  /**
   * Given a UserGameProgress entity, wipe all UserEarnedAchievement
   * entities that are associated with it.
   */
  async cleanUserGameProgress(userGameProgress: UserGameProgress) {
    return await this.db.userEarnedAchievement.deleteMany({
      where: {
        gameProgressEntityId: userGameProgress.id
      }
    });
  }

  async findAllStoredGameAchievements(storedGameId: string) {
    return await this.db.gameAchievement.findMany({
      where: {
        gameId: storedGameId
      }
    });
  }

  async findCompleteUserGameProgress(
    trackedAccountId: string,
    storedGameId: string
  ) {
    return await this.db.userGameProgress.findUnique({
      where: {
        trackedAccountId_gameId: {
          trackedAccountId,
          gameId: storedGameId
        }
      },
      include: {
        game: true,
        earnedAchievements: { include: { achievement: true } }
      }
    });
  }

  async findAllTrackedAccountUserGameProgressByGameIds(
    trackedAccountId: string,
    gameIds: string[]
  ) {
    return await this.db.userGameProgress.findMany({
      where: {
        trackedAccountId,
        gameId: { in: gameIds }
      },
      include: {
        game: true,
        earnedAchievements: { include: { achievement: true } }
      }
    });
  }

  async findExistingGame(gamingService: GamingService, serviceTitleId: string) {
    return await this.db.game.findUnique({
      where: {
        gamingService_serviceTitleId: {
          gamingService,
          serviceTitleId
        }
      }
    });
  }

  async findTrackedAccountByAccountUserName(
    gamingService: GamingService,
    accountUserName: string
  ) {
    return this.db.trackedAccount.findUnique({
      where: {
        gamingService_accountUserName: {
          gamingService,
          accountUserName
        }
      }
    });
  }

  async getMultipleGamesExistenceStatus(
    gamingService: GamingService,
    serviceTitleIds: string[]
  ) {
    const foundGames = await this.db.game.findMany({
      where: {
        gamingService,
        serviceTitleId: {
          in: serviceTitleIds
        }
      }
    });

    const existingGameServiceTitleIds = foundGames
      .filter((foundGame) => !foundGame.isStale)
      .map((foundGame) => foundGame.serviceTitleId);
    const missingGameServiceTitleIds = serviceTitleIds.filter(
      (id) => !existingGameServiceTitleIds.includes(id)
    );
    const staleGameServiceTitleIds = foundGames
      .filter((foundGame) => foundGame.isStale)
      .map((foundStaleGame) => foundStaleGame.serviceTitleId);

    return {
      existingGameServiceTitleIds,
      missingGameServiceTitleIds,
      staleGameServiceTitleIds
    };
  }

  async markGameAsStale(gameId: string) {
    await this.db.game.update({
      where: { id: gameId },
      data: { isStale: true }
    });
    this.#logger.log(`Marked game ${gameId} as stale`);
  }

  /**
   * Nearly all Xbox API calls require a XUID as the input,
   * not a username or gamertag. We only want to fetch a gamertag's
   * XUID once, and after we have it we want to persist it to
   * the TrackedAccount entity.
   */
  async storeTrackedAccountXuid(trackedAccount: TrackedAccount, xuid: string) {
    return await this.db.trackedAccount.update({
      where: {
        id: trackedAccount.id
      },
      data: {
        xboxXuid: xuid
      }
    });
  }

  async updateExistingRetroachievementsUserGameProgress(
    existingUserGameProgress: UserGameProgress,
    allEarnedAchievements: MappedGameAchievement[],
    allStoredAchievements: GameAchievement[]
  ) {
    this.#logger.log(
      `Updating UserGameProgress for ${existingUserGameProgress.trackedAccountId}:${existingUserGameProgress.id}`
    );

    // Before doing anything, purge the list of achievements associated
    // with the UserGameProgress entity. It's easier and faster to do this than
    // try to filter by what's already unlocked.
    await this.cleanUserGameProgress(existingUserGameProgress);

    return await this.db.userGameProgress.update({
      where: { id: existingUserGameProgress.id },
      include: { earnedAchievements: true },
      data: {
        earnedAchievements: {
          createMany: {
            data: allEarnedAchievements.map((achievement) => {
              const storedGameAchievement = allStoredAchievements.find(
                (storedAchievement) =>
                  storedAchievement.serviceAchievementId ===
                  achievement.serviceAchievementId
              );

              // TODO: Throw error if storedGameAchievement not found.

              return {
                gameAchievementId: storedGameAchievement.id,
                // TODO: is this timezone okay?
                earnedOn: achievement.earnedOn
              };
            })
          }
        }
      }
    });
  }

  async updateExistingXboxUserGameProgress(
    existingUserGameProgress: UserGameProgress,
    allEarnedAchievements: MappedGameAchievement[],
    allStoredAchievements: GameAchievement[]
  ) {
    this.#logger.log(
      `Updating UserGameProgress for ${existingUserGameProgress.trackedAccountId}:${existingUserGameProgress.id}`
    );

    // Before doing anything, purge the list of achievements associated
    // with the UserGameProgress entity. It's easier and faster to do this than
    // try to filter by what's already unlocked.
    await this.cleanUserGameProgress(existingUserGameProgress);

    const storedEarnedAchievements = allStoredAchievements.filter(
      (gameAchievement) =>
        allEarnedAchievements
          .map((earnedAchievement) => earnedAchievement.serviceAchievementId)
          .includes(gameAchievement.serviceAchievementId)
    );

    if (storedEarnedAchievements.length !== allEarnedAchievements.length) {
      this.#logger.warn(
        `Missing achievement(s) for UserGameProgress on game XBOX:${existingUserGameProgress.gameId}`
      );

      throw new Error("Missing achievement");
    }

    return await this.db.userGameProgress.update({
      where: { id: existingUserGameProgress.id },
      include: { earnedAchievements: true },
      data: {
        earnedAchievements: {
          createMany: {
            data: allEarnedAchievements.map((achievement) => {
              const storedGameAchievement = allStoredAchievements.find(
                (gameAchievement) =>
                  gameAchievement.serviceAchievementId ===
                  achievement.serviceAchievementId
              );

              return {
                gameAchievementId: storedGameAchievement.id,
                earnedOn: achievement.earnedOn
              };
            })
          }
        }
      }
    });
  }

  async addRetroachievementsGame(mappedCompleteGame: MappedCompleteGame) {
    this.#logger.log(
      `Adding RA title ${mappedCompleteGame.name}:${mappedCompleteGame.serviceTitleId} with ${mappedCompleteGame.achievements.length} achievements`
    );

    const addedGame = await this.db.game.create({
      data: {
        gamingService: "RA",
        name: mappedCompleteGame.name,
        serviceTitleId: mappedCompleteGame.serviceTitleId,
        knownPlayerCount: mappedCompleteGame.knownPlayerCount,
        gamePlatforms: mappedCompleteGame.gamePlatforms,
        isStale: false,
        achievements: {
          createMany: {
            data: mappedCompleteGame.achievements,
            skipDuplicates: true
          }
        }
      }
    });

    this.#logger.log(
      `Added RA title ${mappedCompleteGame.name}:${mappedCompleteGame.serviceTitleId} with ${mappedCompleteGame.achievements.length} achievements as ${addedGame.id}`
    );

    return addedGame;
  }

  async updateRetroachievementsGame(
    mappedCompleteGame: MappedCompleteGame,
    playerCount = 1
  ) {
    this.#logger.log(
      `Updating RA title ${mappedCompleteGame.name}:${mappedCompleteGame.serviceTitleId} with ${mappedCompleteGame.achievements.length} achievements`
    );

    const updatedGame = await this.db.game.update({
      where: {
        gamingService_serviceTitleId: {
          gamingService: "RA",
          serviceTitleId: mappedCompleteGame.serviceTitleId
        }
      },
      data: {
        name: mappedCompleteGame.name,
        knownPlayerCount: playerCount,
        gamePlatforms: mappedCompleteGame.gamePlatforms,
        isStale: false
      }
    });

    // Create any missing achievements.
    await this.db.gameAchievement.createMany({
      skipDuplicates: true,
      data: mappedCompleteGame.achievements.map((achievement) => ({
        ...achievement,
        gameId: updatedGame.id
      }))
    });

    // Update all existing achievements.
    const allGameStoredAchievements = await this.db.gameAchievement.findMany({
      where: { gameId: updatedGame.id }
    });

    const batchUpdateTransaction: PrismaPromise<unknown>[] = [];
    for (const storedAchievement of allGameStoredAchievements) {
      const foundGameAchievement = mappedCompleteGame.achievements.find(
        (gameAchievement) =>
          gameAchievement.serviceAchievementId ===
          storedAchievement.serviceAchievementId
      );

      batchUpdateTransaction.push(
        this.db.gameAchievement.update({
          where: { id: storedAchievement.id },
          data: {
            name: foundGameAchievement.name,
            description: foundGameAchievement.description,
            vanillaPoints: foundGameAchievement.vanillaPoints,
            ratioPoints: foundGameAchievement.ratioPoints,
            sourceImageUrl: foundGameAchievement.sourceImageUrl,
            knownEarnerCount: foundGameAchievement.knownEarnerCount ?? 0
          }
        })
      );
    }

    await this.db.$transaction(batchUpdateTransaction);

    this.#logger.log(
      `Updated RA title ${mappedCompleteGame.name}:${mappedCompleteGame.serviceTitleId} with ${mappedCompleteGame.achievements.length} achievements as ${updatedGame.id}`
    );

    return updatedGame;
  }

  async addXboxGame(mappedCompleteGame: MappedCompleteGame) {
    this.#logger.log(
      `Adding XBOX title ${mappedCompleteGame.name}:${mappedCompleteGame.serviceTitleId} with ${mappedCompleteGame.achievements.length} achievements`
    );

    const addedGame = await this.db.game.create({
      data: {
        gamingService: "XBOX",
        name: mappedCompleteGame.name,
        serviceTitleId: mappedCompleteGame.serviceTitleId,
        gamePlatforms: mappedCompleteGame.gamePlatforms,
        xboxAchievementsSchemaKind:
          mappedCompleteGame.xboxAchievementsSchemaKind,
        isStale: false,
        achievements: {
          createMany: {
            data: mappedCompleteGame.achievements.map((achievement) => ({
              ...achievement,
              earnedOn: undefined
            })),
            skipDuplicates: true
          }
        }
      }
    });

    this.#logger.log(
      `Added XBOX title ${mappedCompleteGame.name}:${mappedCompleteGame.serviceTitleId} with ${mappedCompleteGame.achievements.length} achievements as ${addedGame.id}`
    );

    return addedGame;
  }

  async updateXboxGame(mappedCompleteGame: MappedCompleteGame) {
    this.#logger.log(
      `Updating XBOX title ${mappedCompleteGame.name}:${mappedCompleteGame.serviceTitleId} with ${mappedCompleteGame.achievements.length} achievements`
    );

    const updatedGame = await this.db.game.update({
      where: {
        gamingService_serviceTitleId: {
          gamingService: "XBOX",
          serviceTitleId: mappedCompleteGame.serviceTitleId
        }
      },
      data: {
        name: mappedCompleteGame.name,
        gamePlatforms: mappedCompleteGame.gamePlatforms,
        xboxAchievementsSchemaKind:
          mappedCompleteGame.xboxAchievementsSchemaKind,
        isStale: false
      }
    });

    // Create any missing achievements.
    await this.db.gameAchievement.createMany({
      skipDuplicates: true,
      data: mappedCompleteGame.achievements.map((achievement) => ({
        ...achievement,
        earnedOn: undefined,
        gameId: updatedGame.id
      }))
    });

    // Update all existing achievements.
    const allGameStoredAchievements = await this.db.gameAchievement.findMany({
      where: { gameId: updatedGame.id }
    });

    const batchUpdateTransaction: PrismaPromise<unknown>[] = [];
    for (const storedAchievement of allGameStoredAchievements) {
      const foundGameAchievement = mappedCompleteGame.achievements.find(
        (gameAchievement) =>
          gameAchievement.serviceAchievementId ===
          storedAchievement.serviceAchievementId
      );

      batchUpdateTransaction.push(
        this.db.gameAchievement.update({
          where: { id: storedAchievement.id },
          data: {
            name: foundGameAchievement.name,
            description: foundGameAchievement.description,
            vanillaPoints: foundGameAchievement.vanillaPoints,
            sourceImageUrl: foundGameAchievement.sourceImageUrl,
            knownEarnerPercentage: foundGameAchievement.knownEarnerPercentage
          }
        })
      );
    }

    await this.db.$transaction(batchUpdateTransaction);

    this.#logger.log(
      `Updated XBOX title ${mappedCompleteGame.name}:${mappedCompleteGame.serviceTitleId} with ${mappedCompleteGame.achievements.length} achievements`
    );

    return updatedGame;
  }
}
