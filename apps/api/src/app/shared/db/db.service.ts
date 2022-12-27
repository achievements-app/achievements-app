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
import type {
  Achievement as RaAchievement,
  GameInfoAndUserProgress,
  UserGameCompletion as RaUserGameCompletion
} from "retroachievements-js";

import { db } from "@achievements-app/data-access-db";

import type {
  XboxDeepGameInfo,
  XboxSanitizedAchievementEntity
} from "@/api/shared/integrations/xbox/models";

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
    serviceUserGameProgress: GameInfoAndUserProgress
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
              .filter((achievement) => achievement.dateEarnedHardcore)
              .map((achievement) => {
                const storedGameAchievement = allGameAchievements.find(
                  (gameAchievement) =>
                    gameAchievement.serviceAchievementId ===
                    String(achievement.id)
                );

                return {
                  gameAchievementId: storedGameAchievement.id,
                  // TODO: is this timezone okay?
                  earnedOn: achievement.dateEarnedHardcore
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
    serviceUserGameProgress: XboxDeepGameInfo
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
              .filter((achievement) => achievement.timeUnlocked)
              .map((achievement) => {
                const foundStoredGameAchievement = allGameAchievements.find(
                  (gameAchievement) =>
                    gameAchievement.serviceAchievementId === achievement.id
                );

                // If we fall into this block, the function will almost certainly fail.
                // We need to mark the game as stale.
                if (!foundStoredGameAchievement) {
                  this.markGameAsStale(storedGameId);
                }

                return {
                  gameAchievementId: foundStoredGameAchievement.id,
                  earnedOn: achievement.timeUnlocked
                };
              })
          }
        }
      }
    });
  }

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

    const existingGameServiceTitleIds = foundGames.map(
      (foundGame) => foundGame.serviceTitleId
    );
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
    allEarnedAchievements: RaAchievement[],
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
                  String(achievement.id)
              );

              // TODO: Throw error if storedGameAchievement not found.

              return {
                gameAchievementId: storedGameAchievement.id,
                // TODO: is this timezone okay?
                earnedOn: achievement.dateEarnedHardcore
              };
            })
          }
        }
      }
    });
  }

  async updateExistingXboxUserGameProgress(
    existingUserGameProgress: UserGameProgress,
    allEarnedAchievements: XboxSanitizedAchievementEntity[],
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
          .map((earnedAchievement) => earnedAchievement.id)
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
                  gameAchievement.serviceAchievementId === achievement.id
              );

              return {
                gameAchievementId: storedGameAchievement.id,
                earnedOn: achievement.timeUnlocked
              };
            })
          }
        }
      }
    });
  }

  async addRetroachievementsGame(
    retroachievementsGame: RaUserGameCompletion,
    gameAchievements: RaAchievement[],
    playerCount = 1
  ) {
    this.#logger.log(
      `Adding RA title ${retroachievementsGame.title}:${retroachievementsGame.gameId} with ${gameAchievements.length} achievements`
    );

    const addedGame = await this.db.game.create({
      data: {
        gamingService: "RA",
        name: retroachievementsGame.title,
        serviceTitleId: String(retroachievementsGame.gameId),
        knownPlayerCount: playerCount,
        gamePlatforms: [retroachievementsGame.consoleName],
        isStale: false,
        achievements: {
          createMany: {
            data: gameAchievements.map((gameAchievement) => ({
              name: gameAchievement.title,
              description: String(gameAchievement.description),
              serviceAchievementId: String(gameAchievement.id),
              vanillaPoints: gameAchievement.points,
              ratioPoints: gameAchievement.trueRatio,
              sourceImageUrl: `https://media.retroachievements.org/Badge/${gameAchievement.badgeName}.png`,
              knownEarnerCount: gameAchievement.numAwardedHardcore ?? 0
            })),
            skipDuplicates: true
          }
        }
      }
    });

    this.#logger.log(
      `Added RA title ${retroachievementsGame.title}:${retroachievementsGame.gameId} with ${gameAchievements.length} achievements as ${addedGame.id}`
    );

    return addedGame;
  }

  async updateRetroachievementsGame(
    retroachievementsGame: RaUserGameCompletion,
    gameAchievements: RaAchievement[],
    playerCount = 1
  ) {
    this.#logger.log(
      `Updating RA title ${retroachievementsGame.title}:${retroachievementsGame.gameId} with ${gameAchievements.length} achievements`
    );

    const updatedGame = await this.db.game.update({
      where: {
        gamingService_serviceTitleId: {
          gamingService: "RA",
          serviceTitleId: String(retroachievementsGame.gameId)
        }
      },
      data: {
        name: retroachievementsGame.title,
        knownPlayerCount: playerCount,
        gamePlatforms: [retroachievementsGame.consoleName],
        isStale: false
      }
    });

    // Create any missing achievements.
    await this.db.gameAchievement.createMany({
      skipDuplicates: true,
      data: gameAchievements.map((gameAchievement) => ({
        gameId: updatedGame.id,
        name: gameAchievement.title,
        description: String(gameAchievement.description),
        serviceAchievementId: String(gameAchievement.id),
        vanillaPoints: gameAchievement.points,
        ratioPoints: gameAchievement.trueRatio,
        sourceImageUrl: `https://media.retroachievements.org/Badge/${gameAchievement.badgeName}.png`,
        knownEarnerCount: gameAchievement.numAwardedHardcore ?? 0
      }))
    });

    // Update all existing achievements.
    const allGameStoredAchievements = await this.db.gameAchievement.findMany({
      where: { gameId: updatedGame.id }
    });

    const batchUpdateTransaction: PrismaPromise<any>[] = [];
    for (const storedAchievement of allGameStoredAchievements) {
      const foundGameAchievement = gameAchievements.find(
        (gameAchievement) =>
          String(gameAchievement.id) === storedAchievement.serviceAchievementId
      );

      batchUpdateTransaction.push(
        this.db.gameAchievement.update({
          where: { id: storedAchievement.id },
          data: {
            name: foundGameAchievement.title,
            description: String(foundGameAchievement.description),
            vanillaPoints: foundGameAchievement.points,
            ratioPoints: foundGameAchievement.trueRatio,
            sourceImageUrl: `https://media.retroachievements.org/Badge/${foundGameAchievement.badgeName}.png`,
            knownEarnerCount: foundGameAchievement.numAwardedHardcore ?? 0
          }
        })
      );
    }

    await this.db.$transaction(batchUpdateTransaction);

    this.#logger.log(
      `Updated RA title ${retroachievementsGame.title}:${retroachievementsGame.gameId} with ${gameAchievements.length} achievements as ${updatedGame.id}`
    );

    return updatedGame;
  }

  async updateXboxGame(xboxGame: XboxDeepGameInfo) {
    const gameAchievements = xboxGame.achievements;

    this.#logger.log(
      `Updating XBOX title ${xboxGame.name}:${xboxGame.titleId} with ${gameAchievements.length} achievements`
    );

    const updatedGame = await this.db.game.update({
      where: {
        gamingService_serviceTitleId: {
          gamingService: "XBOX",
          serviceTitleId: xboxGame.titleId
        }
      },
      data: {
        name: xboxGame.name,
        gamePlatforms: xboxGame.devices,
        xboxAchievementsSchemaKind: xboxGame.achievementsSchemaKind,
        isStale: false
      }
    });

    // Create any missing achievements.
    await this.db.gameAchievement.createMany({
      skipDuplicates: true,
      data: gameAchievements.map((gameAchievement) => ({
        gameId: updatedGame.id,
        name: gameAchievement.name,
        description: gameAchievement.description,
        vanillaPoints: gameAchievement.gamerscore,
        sourceImageUrl: gameAchievement.imageUrl ?? undefined,
        serviceAchievementId: gameAchievement.id,
        knownEarnerPercentage: gameAchievement.rarityPercentage
      }))
    });

    // Update all existing achievements.
    const allGameStoredAchievements = await this.db.gameAchievement.findMany({
      where: { gameId: updatedGame.id }
    });

    const batchUpdateTransaction: PrismaPromise<any>[] = [];
    for (const storedAchievement of allGameStoredAchievements) {
      const foundGameAchievement = gameAchievements.find(
        (gameAchievement) =>
          String(gameAchievement.id) === storedAchievement.serviceAchievementId
      );

      batchUpdateTransaction.push(
        this.db.gameAchievement.update({
          where: { id: storedAchievement.id },
          data: {
            name: foundGameAchievement.name,
            description: String(foundGameAchievement.description),
            vanillaPoints: foundGameAchievement.gamerscore,
            sourceImageUrl: foundGameAchievement.imageUrl ?? undefined,
            knownEarnerPercentage: foundGameAchievement.rarityPercentage
          }
        })
      );
    }

    await this.db.$transaction(batchUpdateTransaction);

    this.#logger.log(
      `Updating XBOX title ${xboxGame.name}:${xboxGame.titleId} with ${gameAchievements.length} achievements`
    );

    return updatedGame;
  }

  async addXboxGame(xboxGame: XboxDeepGameInfo) {
    const gameAchievements = xboxGame.achievements;

    this.#logger.log(
      `Adding XBOX title ${xboxGame.name}:${xboxGame.titleId} with ${gameAchievements.length} achievements`
    );

    const addedGame = await this.db.game.create({
      data: {
        gamingService: "XBOX",
        name: xboxGame.name,
        serviceTitleId: xboxGame.titleId,
        gamePlatforms: xboxGame.devices,
        xboxAchievementsSchemaKind: xboxGame.achievementsSchemaKind,
        isStale: false,
        achievements: {
          createMany: {
            data: gameAchievements.map((gameAchievement) => ({
              name: gameAchievement.name,
              description: gameAchievement.description,
              serviceAchievementId: gameAchievement.id,
              vanillaPoints: gameAchievement.gamerscore,
              sourceImageUrl: gameAchievement.imageUrl ?? undefined,
              knownEarnerPercentage: gameAchievement.rarityPercentage
            })),
            skipDuplicates: true
          }
        }
      }
    });

    this.#logger.log(
      `Added XBOX title ${xboxGame.name}:${xboxGame.titleId} with ${gameAchievements.length} achievements as ${addedGame.id}`
    );

    return addedGame;
  }
}
