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
import type {
  GameAchievement,
  GamingService,
  PrismaPromise,
  TrackedAccount,
  UserGameProgress
} from "@achievements-app/data-access-db";
import { db } from "@achievements-app/data-access-db";

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
      `Added ${mappedCompleteGame.gamingService} title ${mappedCompleteGame.name}:${mappedCompleteGame.serviceTitleId} with ${mappedCompleteGame.achievements.length} achievements as ${addedGame.id}`
    );

    return addedGame;
  }

  async addNewUserGameProgress(
    storedGameId: string,
    trackedAccount: TrackedAccount,
    serviceEarnedAchievements: MappedGameAchievement[]
  ) {
    const allGameStoredAchievements = await this.findAllStoredGameAchievements(
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
    const updatedGame = await this.db.game.update({
      where: { id: gameId },
      data: { isStale: true }
    });

    this.#logger.log(`Marked game ${gameId} as stale`);
    return updatedGame;
  }

  /**
   * Nearly all Xbox API calls require a XUID as the input,
   * not a username or gamertag. We only want to fetch a gamertag's
   * XUID once, and after we have it we want to persist it to
   * the TrackedAccount entity.
   */
  async storeTrackedAccountXuid(trackedAccount: TrackedAccount, xuid: string) {
    return await this.db.trackedAccount.update({
      where: { id: trackedAccount.id },
      data: { xboxXuid: xuid }
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
        `Missing achievement(s) for UserGameProgress on game XBOX:${existingUserGameProgress.gameId}`
      );

      throw new Error("Missing achievement");
    }

    // Purge the list of achievements associated with the UserGameProgress entity.
    // It's easier and faster to do this than try to filter by what's already unlocked.
    await this.#cleanUserGameProgress(existingUserGameProgress);

    return await this.db.userGameProgress.update({
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
        xboxAchievementsSchemaKind:
          mappedCompleteGame.xboxAchievementsSchemaKind
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
