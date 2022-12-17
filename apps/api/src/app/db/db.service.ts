import {
  INestApplication,
  Injectable,
  OnModuleInit,
  Logger
} from "@nestjs/common";
import { PrismaClient, GamingService } from "@prisma/client";
import {
  UserGameCompletion,
  Achievement as RaAchievement
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

  async upsertRetroachievementsGame(
    retroachievementsGame: UserGameCompletion,
    gameAchievements: RaAchievement[]
  ) {
    this.#logger.log(
      `Upserting RA game ${retroachievementsGame.gameId} ${retroachievementsGame.title} with ${gameAchievements.length} achievements.`
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
      `Upserted RA game ${retroachievementsGame.gameId} ${retroachievementsGame.title} with ${gameAchievements.length} achievements as ${upsertedGame.id}.`
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
    const foundGame = await this.game.findUnique({
      where: {
        gamingService_serviceTitleId: {
          gamingService,
          serviceTitleId
        }
      }
    });

    this.#logger.log(
      `${gamingService} ${serviceTitleId} ${
        foundGame ? "was found" : "does not yet exist"
      }.`
    );

    return foundGame;
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
}
