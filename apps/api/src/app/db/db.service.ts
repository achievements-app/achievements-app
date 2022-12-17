import {
  INestApplication,
  Injectable,
  Logger,
  OnModuleInit
} from "@nestjs/common";
import {
  GameAchievement,
  GamingService,
  PrismaClient,
  TrackedAccount,
  UserGameProgress
} from "@prisma/client";
import {
  Achievement,
  Achievement as RaAchievement,
  GameInfoAndUserProgress,
  UserGameCompletion
} from "retroachievements-js";

@Injectable()
export class DbService extends PrismaClient implements OnModuleInit {
  #logger = new Logger(DbService.name);

  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    this.$on("beforeExit", async () => {
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

    const newUserGameProgress = await this.userGameProgress.create({
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
    allEarnedAchievements: Achievement[],
    allStoredAchievements: GameAchievement[]
  ) {
    this.#logger.log(
      `Updated UserGameProgress for ${existingUserGameProgress.trackedAccountId} ${existingUserGameProgress.id}`
    );

    return await this.userGameProgress.update({
      where: {
        id: existingUserGameProgress.id
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
            }),
            skipDuplicates: true
          }
        }
      }
    });
  }

  async cleanUserGameProgress(userGameProgress: UserGameProgress) {
    return await this.userEarnedAchievement.deleteMany({
      where: {
        gameProgressEntityId: userGameProgress.id
      }
    });
  }

  async upsertRetroachievementsGame(
    retroachievementsGame: UserGameCompletion,
    gameAchievements: RaAchievement[]
  ) {
    this.#logger.log(
      `Upserting RA title ${retroachievementsGame.gameId} ${retroachievementsGame.title} with ${gameAchievements.length} achievements`
    );

    // We need to make a follow-up API call to get all the achievements for the game.
    const upsertedGame = await this.game.upsert({
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
        gamePlatforms: [retroachievementsGame.consoleName],
        achievements: {
          createMany: {
            data: gameAchievements.map((gameAchievement) => ({
              name: gameAchievement.title,
              description: gameAchievement.description,
              serviceAchievementId: String(gameAchievement.id),
              vanillaPoints: gameAchievement.points,
              ratioPoints: gameAchievement.trueRatio,
              sourceImageUrl: `https://media.retroachievements.org/Badge/${gameAchievement.badgeName}.png`
              // TODO: serviceEarnedPercentage
            })),
            skipDuplicates: true
          }
        }
      },
      update: {
        name: retroachievementsGame.title
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
    const foundGames = await this.game.findMany({
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
    return await this.game.findUnique({
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
    return this.trackedAccount.findUnique({
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
    return await this.userGameProgress.findUnique({
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
    return await this.gameAchievement.findMany({
      where: {
        gameId: storedGameId
      }
    });
  }
}
