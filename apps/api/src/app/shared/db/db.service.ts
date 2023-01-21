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
    gameName?: string,
    options?: Partial<{ trackEventOnScoringThreshold: number }>
  ) {
    this.#logger.log(
      `Creating UserGameProgress for ${trackedAccount.gamingService}:${
        trackedAccount.accountUserName
      }:${storedGameId}${gameName ? ":" + gameName : ""}`
    );

    const allGameStoredAchievements = await this.findAllStoredGameAchievements(
      storedGameId
    );

    let mustMarkAsStale = false;
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

                mustMarkAsStale = true;
              }
            })
          }
        }
      }
    });

    // This means we need to update all the metadata for the game.
    if (mustMarkAsStale) {
      await this.markGameAsStale(storedGameId);
    }

    // The set of conditionals below is used for recording TrackedEvent entities.
    // In the real world, a bot can listen for new TrackedEvent entities and
    // announce them, perhaps, in a Discord channel.
    const {
      isCompletion,
      isPsnCompletion,
      isPsnPlatinum,
      scoringThresholdAchievements
    } = await this.#determineTrackedEventsForProgressCreate(
      serviceEarnedAchievements,
      allGameStoredAchievements,
      options
    );

    this.#logger.log(
      `Created UserGameProgress for ${trackedAccount.gamingService}:${
        trackedAccount.accountUserName
      }:${storedGameId}${gameName ? ":" + gameName : ""} as ${
        newUserGameProgress.id
      }`
    );

    return {
      newUserGameProgress,
      isCompletion,
      isPsnCompletion,
      isPsnPlatinum,
      scoringThresholdAchievements
    };
  }

  async computeGamingServiceCompletionCount(
    trackedAccountId: string,
    gamingService: GamingService
  ) {
    this.#logger.log(
      `Computing ${gamingService} completion count for TrackedAccount ${trackedAccountId}`
    );

    let completionCount = 0;

    // We're selecting the number of unlocked achievements associated
    // with the progress and the number of achievements associated
    // with the game. If these two counts match, it means the progress
    // has unlocked all the achievements with the game and it is indeed
    // a completion.
    const progressesWithCounts = await this.db.userGameProgress.findMany({
      where: { trackedAccountId, game: { gamingService } },
      select: {
        _count: { select: { earnedAchievements: true } },
        game: {
          select: { _count: { select: { achievements: true } } }
        }
      }
    });

    for (const progressEntity of progressesWithCounts) {
      if (
        progressEntity._count.earnedAchievements ===
        progressEntity.game._count.achievements
      ) {
        completionCount += 1;
      }
    }

    return completionCount;
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
      },
      select: {
        id: true,
        serviceAchievementId: true,
        psnTrophyKind: true,
        psnGroupId: true
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

  async findThinUserGameProgress(
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
      select: {
        id: true,
        gameId: true,
        trackedAccountId: true,
        _count: { select: { earnedAchievements: true } }
      }
    });
  }

  async findThinUserGameProgressWithVanillaPoints(
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
      select: {
        id: true,
        gameId: true,
        trackedAccountId: true,
        earnedAchievements: {
          select: { achievement: { select: { vanillaPoints: true } } }
        }
      }
    });
  }

  async findDoesGameExistByServiceTitleId(serviceTitleId: string) {
    const foundGameCount = await this.db.game.count({
      where: { serviceTitleId }
    });

    return foundGameCount > 0;
  }

  async findGameByServiceTitleId(serviceTitleId: string) {
    return await this.db.game.findFirst({
      where: { serviceTitleId },
      select: {
        id: true,
        name: true,
        serviceTitleId: true,
        xboxAchievementsSchemaKind: true
      }
    });
  }

  async findMultipleGamesByServiceTitleIds(
    serviceTitleIds: string[],
    gamingService?: GamingService
  ) {
    return await this.db.game.findMany({
      where: { gamingService, serviceTitleId: { in: serviceTitleIds } },
      select: {
        id: true,
        serviceTitleId: true
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

  async findTrackedAccountPointsSum(trackedAccountId: string): Promise<number> {
    // This cannot be done natively with Prisma's API. If we try to
    // do this with what's available in Prisma's API, we have to fetch
    // every achievement and then iterate over all of them.
    const queryResult = (await this.db.$queryRaw`
      SELECT SUM("GameAchievement"."vanillaPoints")
      FROM "UserGameProgress" as user_game_progress
      JOIN "UserEarnedAchievement" ON user_game_progress.id = "UserEarnedAchievement"."gameProgressEntityId"
      JOIN "GameAchievement" ON "UserEarnedAchievement"."gameAchievementId" = "GameAchievement".id
      WHERE user_game_progress."trackedAccountId" = ${trackedAccountId}
    `) as Array<{ sum: bigint }>;

    if (queryResult.length === 1) {
      return Number(queryResult[0].sum);
    }

    return 0;
  }

  async findTrackedAccountPsnPlatinumCount(
    trackedAccountId: string
  ): Promise<number> {
    const earnedPlatinumTrophies = await this.db.userEarnedAchievement.findMany(
      {
        where: {
          gameProgressEntity: { trackedAccountId },
          achievement: { psnTrophyKind: "Platinum" }
        }
      }
    );

    return earnedPlatinumTrophies.length;
  }

  async getGameProgressEntitiesCount(
    accountUserName: string,
    gamingService: GamingService
  ): Promise<number> {
    const queryResult = await this.db.trackedAccount.findFirst({
      where: { gamingService, accountUserName },
      select: { _count: { select: { gameProgressEntities: true } } }
    });

    return queryResult?._count?.gameProgressEntities ?? 0;
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

  getSiteUserFromTrackedAccountId(trackedAccountId: string) {
    return this.db.trackedAccount.findFirst({
      where: { id: trackedAccountId },
      select: {
        accountUserName: true,
        user: { select: { discordId: true, userName: true } }
      }
    });
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
    existingUserGameProgress: Pick<
      UserGameProgress,
      "id" | "gameId" | "trackedAccountId"
    >,
    allEarnedAchievements: MappedGameAchievement[],
    options?: Partial<{
      trackEventOnScoringThreshold: number;
      isPsnTitle: boolean;
    }>
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

    // Determine if this update should cause some TrackedEvent entities to be recorded.
    const {
      isCompletion,
      isPsnCompletion,
      isPsnPlatinum,
      scoringThresholdAchievements
    } = await this.#determineTrackedEventsForProgressUpdate(
      existingUserGameProgress,
      allGameStoredAchievements,
      allEarnedAchievements,
      options
    );

    // Purge the list of achievements associated with the UserGameProgress entity.
    // It's easier and faster to do this than try to filter by what's already unlocked.
    await this.#cleanUserGameProgress(existingUserGameProgress.id);

    const updatedUserGameProgress = await this.db.userGameProgress.update({
      where: { id: existingUserGameProgress.id },
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
      },
      select: { id: true }
    });

    this.#logger.log(
      `Updated UserGameProgress for ${existingUserGameProgress.trackedAccountId}:${existingUserGameProgress.id}`
    );

    return {
      updatedUserGameProgress,
      isCompletion,
      isPsnCompletion,
      isPsnPlatinum,
      scoringThresholdAchievements
    };
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
      },
      select: { id: true, name: true, serviceTitleId: true }
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
      where: { gameId: updatedGame.id },
      select: { id: true, serviceAchievementId: true }
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
          },
          select: { id: true }
        })
      );
    }

    await this.db.$transaction(batchUpdateTransaction);

    this.#logger.log(
      `Updated ${mappedCompleteGame.gamingService} title ${mappedCompleteGame.name}:${mappedCompleteGame.serviceTitleId} with ${mappedCompleteGame.achievements.length} achievements as ${updatedGame.id}`
    );

    return updatedGame;
  }

  async #buildAchievementsListMeetingScoringThreshold(
    userGameProgressId: string,
    allEarnedAchievements: MappedGameAchievement[],
    scoringThreshold: number
  ) {
    const scoringThresholdAchievements: MappedGameAchievement[] = [];

    const storedThresholdAchievements =
      await this.#getCurrentAchievementsMeetingScoreThresholdForUserProgress(
        userGameProgressId,
        scoringThreshold
      );

    for (const achievement of allEarnedAchievements) {
      if (achievement.vanillaPoints >= scoringThreshold) {
        // Is the achievement already stored?
        // If so, it has likely already been reported.
        const foundAlreadyStored = storedThresholdAchievements.find(
          (storedAchievement) =>
            storedAchievement.achievement.serviceAchievementId ===
            achievement.serviceAchievementId
        );

        // If the achievement meeting the threshold is one
        // we don't have stored progress for the user in our
        // DB yet, we should definitely report an event.
        if (!foundAlreadyStored) {
          scoringThresholdAchievements.push(achievement);
        }
      }
    }

    return scoringThresholdAchievements;
  }

  /**
   * Given a UserGameProgress entity, wipe all UserEarnedAchievement
   * entities that are associated with it.
   */
  async #cleanUserGameProgress(userGameProgressId: string) {
    return await this.db.userEarnedAchievement.deleteMany({
      where: {
        gameProgressEntityId: userGameProgressId
      }
    });
  }

  async #determineTrackedEventsForProgressCreate(
    serviceEarnedAchievements: MappedGameAchievement[],
    allGameStoredAchievements: Array<
      Pick<GameAchievement, "psnGroupId" | "psnTrophyKind">
    >,
    options?: Partial<{ trackEventOnScoringThreshold: number }>
  ) {
    const scoringThresholdAchievements: MappedGameAchievement[] = [];
    if (options?.trackEventOnScoringThreshold) {
      for (const earnedAchievement of serviceEarnedAchievements) {
        if (
          (earnedAchievement?.vanillaPoints ?? 0) >=
          options.trackEventOnScoringThreshold
        ) {
          scoringThresholdAchievements.push(earnedAchievement);
        }
      }
    }

    // The set of conditionals below is used for recording TrackedEvent entities.
    // In the real world, a bot can listen for new TrackedEvent entities and
    // announce them, perhaps, in a Discord channel.
    const isCompletion =
      serviceEarnedAchievements.length === allGameStoredAchievements.length;

    const isPsnPlatinum = serviceEarnedAchievements.some(
      (achievement) => achievement.psnTrophyKind === "Platinum"
    );

    const isPsnCompletion = this.#getIsPsnCompletion(
      isCompletion,
      allGameStoredAchievements
    );

    return {
      isCompletion,
      isPsnCompletion,
      isPsnPlatinum,
      scoringThresholdAchievements
    };
  }

  async #determineTrackedEventsForProgressUpdate(
    existingUserGameProgress: Pick<UserGameProgress, "id">,
    allGameStoredAchievements: Array<
      Pick<GameAchievement, "psnGroupId" | "psnTrophyKind">
    >,
    allEarnedAchievements: MappedGameAchievement[],
    options: Partial<{
      trackEventOnScoringThreshold: number;
      isPsnTitle: boolean;
    }>
  ) {
    // Do we need to report any unlocked achievements meeting a
    // certain point threshold? Eg- New RA 100-point unlocks.
    let scoringThresholdAchievements: MappedGameAchievement[] = [];
    if (options?.trackEventOnScoringThreshold) {
      scoringThresholdAchievements =
        await this.#buildAchievementsListMeetingScoringThreshold(
          existingUserGameProgress.id,
          allEarnedAchievements,
          options.trackEventOnScoringThreshold
        );
    }

    const isCompletion =
      allEarnedAchievements.length === allGameStoredAchievements.length;

    // This block is all for creating TrackedEvent entities related to PSN.
    let isPsnPlatinum: boolean | null = null;
    let isPsnCompletion: boolean | null = null;
    if (options?.isPsnTitle) {
      const isPlatinumUnlockAlreadyStored =
        await this.#getIsPsnPlatinumAlreadyUnlocked(
          existingUserGameProgress.id
        );

      const doesAchievementsListContainPlatinumUnlock =
        allEarnedAchievements.some(
          (earnedAchievement) => earnedAchievement.psnTrophyKind === "Platinum"
        );

      isPsnPlatinum =
        !isPlatinumUnlockAlreadyStored &&
        doesAchievementsListContainPlatinumUnlock;

      isPsnCompletion = this.#getIsPsnCompletion(
        isCompletion,
        allGameStoredAchievements
      );
    }

    return {
      isCompletion,
      isPsnCompletion,
      isPsnPlatinum,
      scoringThresholdAchievements
    };
  }

  async #getCurrentAchievementsMeetingScoreThresholdForUserProgress(
    userGameProgressId: string,
    targetScore: number
  ) {
    return await this.db.userEarnedAchievement.findMany({
      where: {
        gameProgressEntityId: userGameProgressId,
        achievement: { vanillaPoints: { gte: targetScore } }
      },
      select: { achievement: { select: { serviceAchievementId: true } } }
    });
  }

  #getDoesPsnGameHaveDlc(
    allGameStoredAchievements: Array<Pick<GameAchievement, "psnGroupId">>
  ) {
    return (
      [
        // By using a set, we keep only unique elements.
        ...new Set(
          allGameStoredAchievements.map(
            (storedAchievement) => storedAchievement.psnGroupId
          )
        )
        // If there is more than one group ID, the game has DLC.
      ].length > 1
    );
  }

  #getDoesPsnGameHavePlatinumTrophy(
    allGameStoredAchievements: Array<Pick<GameAchievement, "psnTrophyKind">>
  ) {
    return allGameStoredAchievements.some(
      (storedAchievement) => storedAchievement.psnTrophyKind === "Platinum"
    );
  }

  /**
   * Determine if any of the achievements a gaming service reports as
   * earned by the user are, in fact, missing from our database. This
   * commonly happens when an achievement is added to a game after
   * the game (or achievement set) has been published.
   */
  #getIsMissingUserGameProgressAchievement(
    targetGameStoredAchievements: Pick<
      GameAchievement,
      "serviceAchievementId"
    >[],
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

  /**
   * A PSN completion is a little different from just earning a PSN platinum.
   * A "completion" happens when either there is no platinum trophy at all
   * (this often happens in PS3 titles and some newer digital-only titles)
   * or when there is a platinum but there is also DLC with additional achievements
   * and the user has unlocked those as well.
   */
  #getIsPsnCompletion(
    /** Truthy if we know the user just unlocked all the game's achievements */
    wasCompletionDetected: boolean,
    allGameStoredAchievements: Array<
      Pick<GameAchievement, "psnGroupId" | "psnTrophyKind">
    >
  ) {
    const doesGameHavePlatinumTrophy = this.#getDoesPsnGameHavePlatinumTrophy(
      allGameStoredAchievements
    );

    const doesGameHaveDlc = this.#getDoesPsnGameHaveDlc(
      allGameStoredAchievements
    );

    return (
      wasCompletionDetected && (!doesGameHavePlatinumTrophy || doesGameHaveDlc)
    );
  }

  async #getIsPsnPlatinumAlreadyUnlocked(
    userGameProgressId: string
  ): Promise<boolean> {
    const currentStoredPlatinumUnlocksForGameProgress =
      await this.db.userEarnedAchievement.findMany({
        where: {
          gameProgressEntityId: userGameProgressId,
          achievement: { psnTrophyKind: "Platinum" }
        },
        select: { id: true }
      });

    return currentStoredPlatinumUnlocksForGameProgress.length > 0;
  }
}
