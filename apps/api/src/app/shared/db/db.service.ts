import {
  type INestApplication,
  Injectable,
  Logger,
  OnModuleInit
} from "@nestjs/common";
import type {
  GameAchievement,
  GamingService,
  TrackedAccount,
  UserGameProgress
} from "@prisma/client";
import type {
  Achievement as RaAchievement,
  GameInfoAndUserProgress,
  UserGameCompletion as RaUserGameCompletion
} from "retroachievements-js";

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

  async addNewRetroachievementsUserGameProgress(
    storedGameId: string,
    trackedAccount: TrackedAccount,
    serviceUserGameProgress: GameInfoAndUserProgress
  ) {
    const allGameAchievements = await this.findAllStoredGameAchievements(
      storedGameId
    );

    const newUserGameProgress = await this.db.userGameProgress.create({
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

    this.#logger.log(
      `Added UserGameProgress for ${trackedAccount.gamingService} ${trackedAccount.accountUserName} ${storedGameId}: ${newUserGameProgress.id}`
    );

    return newUserGameProgress;
  }

  async updateExistingRetroachievementsUserGameProgress(
    existingUserGameProgress: UserGameProgress,
    allEarnedAchievements: RaAchievement[],
    allStoredAchievements: GameAchievement[]
  ) {
    this.#logger.log(
      `Updating UserGameProgress for ${existingUserGameProgress.trackedAccountId} ${existingUserGameProgress.id}`
    );

    // Before doing anything, purge the list of achievements associated
    // with the UserGameProgress. It's easier and faster to do this than
    // try to filter by what's already unlocked.
    await this.cleanUserGameProgress(existingUserGameProgress);

    return await this.db.userGameProgress.update({
      where: {
        id: existingUserGameProgress.id
      },
      include: {
        earnedAchievements: true
      },
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

  async cleanUserGameProgress(userGameProgress: UserGameProgress) {
    return await this.db.userEarnedAchievement.deleteMany({
      where: {
        gameProgressEntityId: userGameProgress.id
      }
    });
  }

  async upsertRetroachievementsGame(
    retroachievementsGame: RaUserGameCompletion,
    gameAchievements: RaAchievement[],
    playerCount = 1
  ) {
    this.#logger.log(
      `Upserting RA title ${retroachievementsGame.gameId} ${retroachievementsGame.title} with ${gameAchievements.length} achievements`
    );

    const upsertedGame = await this.db.game.upsert({
      where: {
        gamingService_serviceTitleId: {
          gamingService: "RA",
          serviceTitleId: String(retroachievementsGame.gameId)
        }
      },
      create: {
        gamingService: "RA",
        name: retroachievementsGame.title,
        serviceTitleId: String(retroachievementsGame.gameId),
        knownPlayerCount: playerCount,
        gamePlatforms: [retroachievementsGame.consoleName],
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
      },
      update: {
        name: retroachievementsGame.title,
        knownPlayerCount: playerCount
      }
    });

    this.#logger.log(
      `Upserted RA title ${retroachievementsGame.gameId} ${retroachievementsGame.title} with ${gameAchievements.length} achievements as ${upsertedGame.id}`
    );

    return upsertedGame;
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

    return { existingGameServiceTitleIds, missingGameServiceTitleIds };
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
      include: { earnedAchievements: true }
    });
  }

  async findAllStoredGameAchievements(storedGameId: string) {
    return await this.db.gameAchievement.findMany({
      where: {
        gameId: storedGameId
      }
    });
  }
}
