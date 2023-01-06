import {
  type INestApplication,
  Injectable,
  Logger,
  OnModuleInit
} from "@nestjs/common";

import type {
  MappedCompleteGame,
  MappedGameAchievement
} from "@achievements-app/data-access-common-models";
import {
  db,
  GameAchievement,
  GamingService,
  PrismaPromise,
  TrackedAccount,
  UserGameProgress,
  UserSyncPriority
} from "@achievements-app/data-access-db";

import type { CompleteUserGameProgress } from "./models";

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

  async addMappedCompleteGame(mappedCompleteGame: MappedCompleteGame) {
    this.#logger.log(
      `Adding ${mappedCompleteGame.gamingService} title ${mappedCompleteGame.name}:${mappedCompleteGame.serviceTitleId} with ${mappedCompleteGame.achievements.length} achievements`
    );

    const addedGame = await this.db.game.create({
      data: {
        gamingService: mappedCompleteGame.gamingService,
        name: mappedCompleteGame.name,
        serviceTitleId: mappedCompleteGame.serviceTitleId,
        knownPlayerCount: mappedCompleteGame.knownPlayerCount,
        gamePlatforms: mappedCompleteGame.gamePlatforms,
        xboxAchievementsSchemaKind:
          mappedCompleteGame.xboxAchievementsSchemaKind,
        isStale: false,
        coverImageUrl: mappedCompleteGame.coverImageUrl,
        psnServiceName: mappedCompleteGame.psnServiceName,
        achievements: {
          createMany: {
            data: mappedCompleteGame.achievements.map((achievement) => ({
              ...achievement,
              earnedOn: undefined,
              isEarned: undefined
            })),
            skipDuplicates: true
          }
        }
      }
    });

    this.#logger.log(
      `Added ${mappedCompleteGame.gamingService} title ${mappedCompleteGame.name}:${mappedCompleteGame.serviceTitleId} with ${mappedCompleteGame.achievements.length} achievements as ${addedGame.id}`
    );

    return addedGame;
  }

  async addNewUserGameProgress(
    storedGameId: string,
    trackedAccount: TrackedAccount,
    serviceEarnedAchievements: MappedGameAchievement[],
    gameName?: string
  ) {
    this.#logger.log(
      `Creating UserGameProgress for ${trackedAccount.gamingService}:${
        trackedAccount.accountUserName
      }:${storedGameId}${gameName ? ":" + gameName : ""}`
    );

    const allGameStoredAchievements = await this.findAllStoredGameAchievements(
      storedGameId
    );

    const newUserGameProgress = await this.db.userGameProgress.create({
      data: {
        gameId: storedGameId,
        trackedAccountId: trackedAccount.id,
        earnedAchievements: {
          createMany: {
            skipDuplicates: true,
            data: serviceEarnedAchievements.map((achievement) => {
              const foundStoredGameAchievement = allGameStoredAchievements.find(
                (gameAchievement) =>
                  gameAchievement.serviceAchievementId ===
                  achievement.serviceAchievementId
              );

              try {
                return {
                  gameAchievementId: foundStoredGameAchievement.id,
                  // TODO: is this timezone okay?
                  earnedOn: achievement.earnedOn
                };
              } catch (error) {
                this.#logger.error(
                  `Tried to log progress for a missing achievement. Marking game ${storedGameId} as stale.`,
                  error
                );

                this.markGameAsStale(storedGameId);
              }
            })
          }
        }
      }
    });

    this.#logger.log(
      `Created UserGameProgress for ${trackedAccount.gamingService}:${
        trackedAccount.accountUserName
      }:${storedGameId}${gameName ? ":" + gameName : ""} as ${
        newUserGameProgress.id
      }`
    );

    return newUserGameProgress;
  }

  async findAllHighPriorityUsers() {
    return await this.db.user.findMany({
      where: { syncPriority: UserSyncPriority.High },
      include: { trackedAccounts: true }
    });
  }

  async findAllStoredGameAchievements(storedGameId: string) {
    return await this.db.gameAchievement.findMany({
      where: {
        gameId: storedGameId
      }
    });
  }

  async findAllThinUserGameProgressByGamingService(
    trackedAccountId: string,
    gamingService: GamingService
  ) {
    this.#logger.log(
      `Finding all thin UserGameProgress entities for ${trackedAccountId}`
    );

    const allThinUserGameProgresses = await this.db.userGameProgress.findMany({
      where: { trackedAccountId, game: { gamingService } },
      select: {
        game: {
          select: { serviceTitleId: true }
        },
        _count: {
          select: {
            earnedAchievements: true
          }
        }
      }
    });

    this.#logger.log(
      `Found ${allThinUserGameProgresses.length} thin UserGameProgress entities for ${trackedAccountId}`
    );

    return allThinUserGameProgresses;
  }

  /**
   * WARNING: This call uses a lot of bandwidth! Use sparingly, and
   * never on a scheduled job if it can be avoided.
   */
  async findAllCompleteUserGameProgress(
    trackedAccountId: string
  ): Promise<CompleteUserGameProgress[]> {
    this.#logger.log(
      `Finding all CompleteUserGameProgress entities for ${trackedAccountId}`
    );

    const allCompleteUserGameProgresses: CompleteUserGameProgress[] =
      await this.db.userGameProgress.findMany({
        where: { trackedAccountId },
        include: {
          earnedAchievements: {
            include: { achievement: true }
          },
          game: { include: { achievements: true } }
        }
      });

    this.#logger.log(
      `Found ${allCompleteUserGameProgresses.length} CompleteUserGameProgress entities for ${trackedAccountId}`
    );

    return allCompleteUserGameProgresses;
  }

  /**
   * WARNING: This call uses a lot of bandwidth! Use sparingly, and
   * never on a scheduled job if it can be avoided.
   */
  async findAllCompleteUserGameProgressByGamingService(
    trackedAccountId: string,
    gamingService: GamingService
  ) {
    this.#logger.log(
      `Finding all ${gamingService} complete UserGameProgress for ${trackedAccountId}`
    );

    const allUserGameProgress = await this.db.userGameProgress.findMany({
      where: { trackedAccountId, game: { gamingService } },
      include: {
        earnedAchievements: { select: { id: true } },
        game: { select: { serviceTitleId: true } }
      }
    });

    this.#logger.log(
      `Found ${allUserGameProgress.length} complete UserGameProgress for ${trackedAccountId}`
    );

    return allUserGameProgress;
  }

  async findAllTrackedAccountUserGameProgressByGameIds(
    trackedAccountId: string,
    gameIds: string[]
  ) {
    return await this.db.userGameProgress.findMany({
      where: { trackedAccountId, gameId: { in: gameIds } },
      select: {
        game: {
          select: { serviceTitleId: true }
        },
        earnedAchievements: {
          select: {
            achievement: { select: { vanillaPoints: true } }
          }
        }
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

  async findGameByServiceTitleId(serviceTitleId: string) {
    return await this.db.game.findFirst({ where: { serviceTitleId } });
  }

  async findMultipleGamesByServiceTitleIds(
    serviceTitleIds: string[],
    gamingService?: GamingService
  ) {
    return await this.db.game.findMany({
      where: { gamingService, serviceTitleId: { in: serviceTitleIds } }
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
      select: {
        isStale: true,
        serviceTitleId: true,
        name: true
      },
      where: {
        gamingService,
        serviceTitleId: {
          in: serviceTitleIds
        }
      }
    });

    const existingGames = foundGames.filter((foundGame) => !foundGame.isStale);

    const existingGameServiceTitleIds = existingGames.map(
      (foundGame) => foundGame.serviceTitleId
    );
    const missingGameServiceTitleIds = serviceTitleIds.filter(
      (id) => !existingGameServiceTitleIds.includes(id)
    );
    const staleGameServiceTitleIds = foundGames
      .filter((foundGame) => foundGame.isStale)
      .map((foundStaleGame) => foundStaleGame.serviceTitleId);

    return {
      existingGames,
      existingGameServiceTitleIds,
      missingGameServiceTitleIds,
      staleGameServiceTitleIds
    };
  }

  async markGameAsStale(gameId: string) {
    const updatedGame = await this.db.game.update({
      where: { id: gameId },
      data: { isStale: true }
    });

    this.#logger.log(`Marked game ${gameId} as stale`);
    return updatedGame;
  }

  /**
   * Some gaming services, notably Xbox and PSN, require a unique
   * account ID as the user input rather than a username or gamertag.
   * We only want to fetch an account's unique ID once, and after we
   * have it we want to persist it to the TrackedAccount entity.
   */
  async storeTrackedAccountUniqueAccountId(
    trackedAccount: TrackedAccount,
    uniqueAccountId: string
  ) {
    return await this.db.trackedAccount.update({
      where: { id: trackedAccount.id },
      data: { serviceAccountId: uniqueAccountId }
    });
  }

  async updateExistingUserGameProgress(
    existingUserGameProgress: UserGameProgress,
    allEarnedAchievements: MappedGameAchievement[]
  ) {
    const allGameStoredAchievements = await this.findAllStoredGameAchievements(
      existingUserGameProgress.gameId
    );

    this.#logger.log(
      `Updating UserGameProgress for ${existingUserGameProgress.trackedAccountId}:${existingUserGameProgress.id}`
    );

    // If we are missing any achievements from the game that the user
    // has earned, we cannot actually continue. We'll throw an error, and
    // it's very likely the caller of this method will mark the game as stale.
    // After being marked as stale, the game will be refreshed and subsequent
    // calls of this method with the same arguments will likely not throw.
    const isMissingAnyStoredAchievements =
      this.#getIsMissingUserGameProgressAchievement(
        allGameStoredAchievements,
        allEarnedAchievements
      );

    if (isMissingAnyStoredAchievements) {
      this.#logger.warn(
        `Missing achievement(s) for UserGameProgress on game ${existingUserGameProgress.gameId}`
      );

      throw new Error("Missing achievement");
    }

    // Purge the list of achievements associated with the UserGameProgress entity.
    // It's easier and faster to do this than try to filter by what's already unlocked.
    await this.#cleanUserGameProgress(existingUserGameProgress);

    const updatedUserGameProgress = await this.db.userGameProgress.update({
      where: { id: existingUserGameProgress.id },
      include: { earnedAchievements: true },
      data: {
        earnedAchievements: {
          createMany: {
            data: allEarnedAchievements.map((achievement) => {
              const storedGameAchievement = allGameStoredAchievements.find(
                (storedAchievement) =>
                  storedAchievement.serviceAchievementId ===
                  achievement.serviceAchievementId
              );

              return {
                gameAchievementId: storedGameAchievement.id,
                // TODO: #RA is this timezone okay?
                earnedOn: achievement.earnedOn
              };
            })
          }
        }
      }
    });

    this.#logger.log(
      `Updated UserGameProgress for ${existingUserGameProgress.trackedAccountId}:${existingUserGameProgress.id}`
    );

    return updatedUserGameProgress;
  }

  async updateMappedCompleteGame(
    mappedCompleteGame: MappedCompleteGame,
    // TODO: #RA We can get this value for RA, but aren't currently.
    knownPlayerCount = 1
  ) {
    this.#logger.log(
      `Updating ${mappedCompleteGame.gamingService} title ${mappedCompleteGame.name}:${mappedCompleteGame.serviceTitleId} with ${mappedCompleteGame.achievements.length} achievements`
    );

    const updatedGame = await this.db.game.update({
      where: {
        gamingService_serviceTitleId: {
          gamingService: mappedCompleteGame.gamingService,
          serviceTitleId: mappedCompleteGame.serviceTitleId
        }
      },
      data: {
        knownPlayerCount,
        name: mappedCompleteGame.name,
        gamePlatforms: mappedCompleteGame.gamePlatforms,
        isStale: false,
        coverImageUrl: mappedCompleteGame.coverImageUrl,
        xboxAchievementsSchemaKind:
          mappedCompleteGame.xboxAchievementsSchemaKind,
        psnServiceName: mappedCompleteGame.psnServiceName
      }
    });

    // Create any missing achievements.
    await this.db.gameAchievement.createMany({
      skipDuplicates: true,
      data: mappedCompleteGame.achievements.map((achievement) => ({
        ...achievement,
        earnedOn: undefined,
        isEarned: undefined,
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
            knownEarnerCount: foundGameAchievement.knownEarnerCount ?? 0,
            knownEarnerPercentage: foundGameAchievement.knownEarnerPercentage
          }
        })
      );
    }

    await this.db.$transaction(batchUpdateTransaction);

    this.#logger.log(
      `Updated ${mappedCompleteGame.gamingService} title ${mappedCompleteGame.name}:${mappedCompleteGame.serviceTitleId} with ${mappedCompleteGame.achievements.length} achievements as ${updatedGame.id}`
    );

    return updatedGame;
  }

  /**
   * Given a UserGameProgress entity, wipe all UserEarnedAchievement
   * entities that are associated with it.
   */
  async #cleanUserGameProgress(userGameProgress: UserGameProgress) {
    return await this.db.userEarnedAchievement.deleteMany({
      where: {
        gameProgressEntityId: userGameProgress.id
      }
    });
  }

  /**
   * Determine if any of the achievements a gaming service reports as
   * earned by the user are, in fact, missing from our database. This
   * commonly happens when an achievement is added to a game after
   * the game (or achievement set) has been published.
   */
  #getIsMissingUserGameProgressAchievement(
    targetGameStoredAchievements: GameAchievement[],
    reportedEarnedAchievements: MappedGameAchievement[]
  ) {
    const storedEarnedAchievements = targetGameStoredAchievements.filter(
      (gameAchievement) =>
        reportedEarnedAchievements
          .map((earnedAchievement) => earnedAchievement.serviceAchievementId)
          .includes(gameAchievement.serviceAchievementId)
    );

    return (
      storedEarnedAchievements.length !== reportedEarnedAchievements.length
    );
  }
}
