/* eslint-disable sonarjs/no-duplicate-string */

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { db } from "@achievements-app/data-access-db";
import { createGame, createUser } from "@achievements-app/utils-db";
import {
  convertAchievementsListToMap,
  generateRaAchievement,
  generateRaGameExtended,
  generateRaGameExtendedAchievementEntityWithUserProgress,
  generateRaGameInfoAndUserProgress,
  generateRaUserGameCompletion,
  generateRaUserRecentlyPlayedGame
} from "@achievements-app/utils-model-generators";

import { DbService } from "@/api/shared/db/db.service";
import type {
  RetroachievementsHundredPointUnlockEvent,
  RetroachievementsNewMasteryEvent
} from "@/api/shared/tracked-events/models";

import { RetroachievementsModule } from "./retroachievements.module";
import { RetroachievementsService } from "./retroachievements.service";
import { RetroachievementsDataService } from "./retroachievements-data.service";

describe("Service: RetroachievementsService", () => {
  let app: INestApplication;
  let dataService: RetroachievementsDataService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RetroachievementsModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    dataService = app.get(RetroachievementsDataService);
  });

  afterAll(async () => {
    const dbService = app.get(DbService);
    await dbService.enableShutdownHooks(app);

    await app.close();
  });

  it("can instantiate #sanity", () => {
    // ARRANGE
    const retroachievementsService = app.get(RetroachievementsService);

    // ASSERT
    expect(retroachievementsService).toBeTruthy();
  });

  it("given a set of title IDs, can fetch the titles from RetroAchievements and store their metadatas in our DB", async () => {
    // ARRANGE
    const mockServiceTitleIds = ["12345"];
    const mockServiceTitle = generateRaGameExtended(
      {
        id: Number(mockServiceTitleIds[0])
      },
      { achievementCount: 1, achievementPoints: 5 }
    );

    jest
      .spyOn(dataService, "fetchDeepGameInfo")
      .mockResolvedValueOnce(mockServiceTitle);

    const retroachievementsService = app.get(RetroachievementsService);

    // ACT
    const addedGames =
      await retroachievementsService.addRetroachievementsTitlesToDb(
        mockServiceTitleIds
      );

    // ASSERT
    expect(addedGames.length).toEqual(1);

    const addedGame = await db.game.findFirst({
      include: { achievements: true }
    });

    expect(addedGame.name).toEqual(mockServiceTitle.title);
    expect(addedGame.serviceTitleId).toEqual(mockServiceTitleIds[0]);
    expect(addedGame.gamingService).toEqual("RA");
    expect(addedGame.achievements.length).toEqual(
      Object.keys(mockServiceTitle.achievements).length
    );

    expect(addedGame.achievements[0].vanillaPoints).toEqual(
      mockServiceTitle.achievements[0].points
    );
  });

  it("can retrieve and create a new UserGameProgress entity for a given TrackedAccount", async () => {
    // ARRANGE
    const user = await createUser();
    const trackedAccount = user.trackedAccounts.find(
      (trackedAccount) => trackedAccount.gamingService === "RA"
    );

    const mockServiceTitleIds = ["12345"];
    const mockServiceTitle = generateRaGameExtended(
      {
        id: Number(mockServiceTitleIds[0])
      },
      { achievementCount: 3, achievementPoints: 5 }
    );

    jest
      .spyOn(dataService, "fetchDeepGameInfo")
      .mockResolvedValueOnce(mockServiceTitle);

    const retroachievementsService = app.get(RetroachievementsService);

    const addedGames =
      await retroachievementsService.addRetroachievementsTitlesToDb(
        mockServiceTitleIds
      );

    jest
      .spyOn(dataService, "fetchUserGameProgress")
      .mockResolvedValueOnce(
        generateRaGameInfoAndUserProgress(
          { id: Number(mockServiceTitleIds[0]) },
          { earnedAchievementCount: 2, achievementPoints: 5 }
        )
      );

    // ACT
    const newUserGameProgress =
      await retroachievementsService.createRetroachievementsUserGameProgress(
        addedGames[0].id,
        trackedAccount,
        mockServiceTitleIds[0]
      );

    // ASSERT
    expect(newUserGameProgress).toBeTruthy();
    expect(newUserGameProgress.gameId).toEqual(addedGames[0].id);
    expect(newUserGameProgress.trackedAccountId).toEqual(trackedAccount.id);

    const completeUserGameProgress = await db.userGameProgress.findFirst({
      include: { earnedAchievements: true }
    });

    expect(completeUserGameProgress.earnedAchievements.length).toEqual(2);
  });

  it("given a newly added user progress is also a completion, requests a new TrackedEvent to be created", async () => {
    // ARRANGE
    const addedUser = await createUser();

    const trackedAccount = addedUser.trackedAccounts.find(
      (trackedAccount) => trackedAccount.gamingService === "RA"
    );

    await db.trackedAccount.update({
      where: { id: trackedAccount.id },
      data: { createdAt: new Date("2020-01-01") }
    });

    const mockServiceTitleIds = ["12345"];
    const mockServiceTitle = generateRaGameExtended(
      {
        id: Number(mockServiceTitleIds[0])
      },
      { achievementCount: 3, achievementPoints: 10 }
    );

    jest
      .spyOn(dataService, "fetchDeepGameInfo")
      .mockResolvedValueOnce(mockServiceTitle);

    const retroachievementsService = app.get(RetroachievementsService);

    const addedGames =
      await retroachievementsService.addRetroachievementsTitlesToDb(
        mockServiceTitleIds
      );

    jest
      .spyOn(dataService, "fetchUserGameProgress")
      .mockResolvedValueOnce(
        generateRaGameInfoAndUserProgress(
          { id: Number(mockServiceTitleIds[0]) },
          { earnedAchievementCount: 3, achievementPoints: 10 }
        )
      );

    // ACT
    await retroachievementsService.createRetroachievementsUserGameProgress(
      addedGames[0].id,
      trackedAccount,
      mockServiceTitleIds[0]
    );

    // ASSERT
    const foundTrackedEvent = await db.trackedEvent.findFirst();

    expect(foundTrackedEvent).toBeTruthy();
    expect(foundTrackedEvent.kind).toEqual("RA_NewMastery");
    expect(foundTrackedEvent.trackedAccountId).toEqual(trackedAccount.id);

    const eventData =
      foundTrackedEvent.eventData as RetroachievementsNewMasteryEvent;

    expect(eventData.game).toEqual({
      name: mockServiceTitle.title,
      consoleName: mockServiceTitle.consoleName,
      serviceTitleId: String(mockServiceTitle.id)
    });

    expect(eventData.appUserName).toEqual(addedUser.userName);
    expect(eventData.trackedAccountUserName).toEqual(
      trackedAccount.accountUserName
    );
    expect(eventData.userMasteryCount).toEqual(1);
  });

  it("given a RetroAchievements username, can determine which of the user's games are missing and/or stored in our DB", async () => {
    // ARRANGE
    const storedUser = await createUser();
    const foundTrackedAccount = storedUser.trackedAccounts.find(
      (account) => account.gamingService === "RA"
    );

    const storedGame = await createGame({
      gamingService: "RA",
      serviceTitleId: "12345"
    });

    jest.spyOn(dataService, "fetchAllUserGames").mockResolvedValueOnce([
      // Two missing, one present.
      generateRaUserGameCompletion(),
      generateRaUserGameCompletion(),
      generateRaUserGameCompletion({
        gameId: Number(storedGame.serviceTitleId)
      })
    ]);

    const retroachievementsService = app.get(RetroachievementsService);

    // ACT
    const {
      allUserGames,
      existingGameServiceTitleIds,
      missingGameServiceTitleIds,
      staleGameServiceTitleIds
    } =
      await retroachievementsService.getMissingAndPresentUserRetroachievementsGames(
        foundTrackedAccount.accountUserName,
        { isFullSync: true }
      );

    // ASSERT
    expect(allUserGames.length).toEqual(3);
    expect(staleGameServiceTitleIds.length).toEqual(0);
    expect(missingGameServiceTitleIds.length).toEqual(2);
    expect(existingGameServiceTitleIds).toEqual([storedGame.serviceTitleId]);
  });

  it("given a RetroAchievements username and no stored progress in the DB, forces a full sync even if a partial sync is requested", async () => {
    // ARRANGE
    const storedUser = await createUser();
    const foundTrackedAccount = storedUser.trackedAccounts.find(
      (account) => account.gamingService === "RA"
    );

    const storedGame = await createGame({
      gamingService: "RA",
      serviceTitleId: "12345"
    });

    jest.spyOn(dataService, "fetchAllUserGames").mockResolvedValueOnce([
      // Two missing, one present.
      generateRaUserGameCompletion(),
      generateRaUserGameCompletion(),
      generateRaUserGameCompletion({
        gameId: Number(storedGame.serviceTitleId)
      })
    ]);

    const retroachievementsService = app.get(RetroachievementsService);

    // ACT
    const {
      allUserGames,
      existingGameServiceTitleIds,
      missingGameServiceTitleIds,
      staleGameServiceTitleIds
    } =
      await retroachievementsService.getMissingAndPresentUserRetroachievementsGames(
        foundTrackedAccount.accountUserName,
        { isFullSync: false }
      );

    // ASSERT
    expect(allUserGames.length).toEqual(3);
    expect(staleGameServiceTitleIds.length).toEqual(0);
    expect(missingGameServiceTitleIds.length).toEqual(2);
    expect(existingGameServiceTitleIds).toEqual([storedGame.serviceTitleId]);
  });

  it("given a RetroAchievements username and stored progress in the DB, allows a partial sync", async () => {
    // ARRANGE
    // --- START: SET UP A NEW USER, A RA GAME, AND SOME USER PROGRESS ---
    const storedUser = await createUser();
    const foundTrackedAccount = storedUser.trackedAccounts.find(
      (account) => account.gamingService === "RA"
    );

    const mockServiceTitleIds = ["12345"];
    const mockServiceTitle = generateRaGameExtended(
      {
        id: Number(mockServiceTitleIds[0])
      },
      { achievementCount: 3, achievementPoints: 5 }
    );

    jest
      .spyOn(dataService, "fetchDeepGameInfo")
      .mockResolvedValueOnce(mockServiceTitle);

    const retroachievementsService = app.get(RetroachievementsService);

    const addedGames =
      await retroachievementsService.addRetroachievementsTitlesToDb(
        mockServiceTitleIds
      );

    jest
      .spyOn(dataService, "fetchUserGameProgress")
      .mockResolvedValueOnce(
        generateRaGameInfoAndUserProgress(
          { id: Number(mockServiceTitleIds[0]) },
          { earnedAchievementCount: 2, achievementPoints: 5 }
        )
      );

    await retroachievementsService.createRetroachievementsUserGameProgress(
      addedGames[0].id,
      foundTrackedAccount,
      mockServiceTitleIds[0]
    );
    // --- END: SET UP A NEW USER, A RA GAME, AND SOME USER PROGRESS ---

    jest.spyOn(dataService, "fetchRecentUserGames").mockResolvedValueOnce([
      // Two missing, one present.
      generateRaUserRecentlyPlayedGame(),
      generateRaUserRecentlyPlayedGame(),
      generateRaUserRecentlyPlayedGame({
        gameId: Number(addedGames[0].serviceTitleId)
      })
    ]);

    // ACT
    const {
      allUserGames,
      existingGameServiceTitleIds,
      missingGameServiceTitleIds,
      staleGameServiceTitleIds
    } =
      await retroachievementsService.getMissingAndPresentUserRetroachievementsGames(
        foundTrackedAccount.accountUserName,
        { isFullSync: false }
      );

    // ASSERT
    expect(allUserGames.length).toEqual(3);
    expect(staleGameServiceTitleIds.length).toEqual(0);
    expect(missingGameServiceTitleIds.length).toEqual(2);
    expect(existingGameServiceTitleIds).toEqual([addedGames[0].serviceTitleId]);
  });

  it("while fetching a list of user's games, informs the caller of which games in the DB are stale", async () => {
    // ARRANGE
    const storedUser = await createUser();
    const foundTrackedAccount = storedUser.trackedAccounts.find(
      (account) => account.gamingService === "RA"
    );

    const storedGame = await createGame({
      gamingService: "RA",
      serviceTitleId: "12345",
      isStale: true
    });

    jest.spyOn(dataService, "fetchAllUserGames").mockResolvedValueOnce([
      // Two missing, one present.
      generateRaUserGameCompletion(),
      generateRaUserGameCompletion(),
      generateRaUserGameCompletion({
        gameId: Number(storedGame.serviceTitleId)
      })
    ]);

    const retroachievementsService = app.get(RetroachievementsService);

    // ACT
    const { staleGameServiceTitleIds } =
      await retroachievementsService.getMissingAndPresentUserRetroachievementsGames(
        foundTrackedAccount.accountUserName,
        { isFullSync: true }
      );

    // ASSERT
    expect(staleGameServiceTitleIds.length).toEqual(1);
  });

  it("given a list of serviceTitleIds, fetches the games from RetroAchievements and updates them in our DB", async () => {
    // ARRANGE
    const storedGame = await createGame({
      gamingService: "RA",
      serviceTitleId: "12345",
      name: "Game Name ABC" // We're going to change this via our update.
    });

    const mockServiceTitle = generateRaGameExtended({
      id: Number(storedGame.serviceTitleId),
      title: "Game Name XYZ"
    });

    jest
      .spyOn(dataService, "fetchDeepGameInfo")
      .mockResolvedValueOnce(mockServiceTitle);

    const retroachievementsService = app.get(RetroachievementsService);

    // ACT
    const updatedGames =
      await retroachievementsService.updateRetroachievementsTitlesInDb([
        storedGame.serviceTitleId
      ]);

    // ASSERT
    expect(updatedGames.length).toEqual(1);
    expect(updatedGames[0].name).toEqual("Game Name XYZ");
  });

  it("given a user has unlocked achievements for a game they already have stored progress on, can update their progress", async () => {
    // ARRANGE
    /* -- START: Create the initial user progress -- */
    // They've earned 2 of 4 achievements.
    const user = await createUser();
    const trackedAccount = user.trackedAccounts.find(
      (trackedAccount) => trackedAccount.gamingService === "RA"
    );

    const mockServiceTitleIds = ["12345"];
    const mockServiceTitle = generateRaGameExtended(
      {
        id: Number(mockServiceTitleIds[0])
      },
      { achievementCount: 4, achievementPoints: 20 }
    );

    jest
      .spyOn(dataService, "fetchDeepGameInfo")
      .mockResolvedValueOnce(mockServiceTitle);

    const retroachievementsService = app.get(RetroachievementsService);

    const addedGames =
      await retroachievementsService.addRetroachievementsTitlesToDb(
        mockServiceTitleIds
      );

    jest
      .spyOn(dataService, "fetchUserGameProgress")
      .mockResolvedValueOnce(
        generateRaGameInfoAndUserProgress(
          { id: Number(mockServiceTitleIds[0]) },
          { earnedAchievementCount: 2, achievementPoints: 20 }
        )
      );

    const newUserGameProgress =
      await retroachievementsService.createRetroachievementsUserGameProgress(
        addedGames[0].id,
        trackedAccount,
        mockServiceTitleIds[0]
      );
    /* -- END: Create the initial user progress */

    // ACT
    // Now we'll have them unlock 1 more achievement.
    jest
      .spyOn(dataService, "fetchUserGameProgress")
      .mockResolvedValueOnce(
        generateRaGameInfoAndUserProgress(
          { id: Number(mockServiceTitleIds[0]) },
          { earnedAchievementCount: 3, achievementPoints: 20 }
        )
      );

    await retroachievementsService.updateRetroachievementsUserGameProgress(
      newUserGameProgress,
      addedGames[0].id,
      trackedAccount,
      mockServiceTitleIds[0]
    );

    // ASSERT
    const foundUserGameProgress = await db.userGameProgress.findFirst({
      select: { earnedAchievements: true }
    });

    expect(foundUserGameProgress).toBeTruthy();
    expect(foundUserGameProgress.earnedAchievements).toHaveLength(3);
  });

  it("given a user has mastered a game they have in progress, tracks an event for the mastery", async () => {
    // ARRANGE
    /* -- START: Create the initial user progress -- */
    // They've earned 1 of 2 achievements.
    const user = await createUser();

    const trackedAccount = user.trackedAccounts.find(
      (trackedAccount) => trackedAccount.gamingService === "RA"
    );

    await db.trackedAccount.update({
      where: { id: trackedAccount.id },
      data: { createdAt: new Date("2020-01-01") }
    });

    const mockServiceTitleIds = ["12345"];
    const mockOriginalAchievements = [
      generateRaAchievement({ id: 0, points: 10 }),
      generateRaAchievement({ id: 1, points: 20 })
    ];

    const mockServiceTitle = generateRaGameExtended({
      id: Number(mockServiceTitleIds[0]),
      achievements: convertAchievementsListToMap(mockOriginalAchievements)
    });

    jest
      .spyOn(dataService, "fetchDeepGameInfo")
      .mockResolvedValueOnce(mockServiceTitle);

    const retroachievementsService = app.get(RetroachievementsService);

    const addedGames =
      await retroachievementsService.addRetroachievementsTitlesToDb(
        mockServiceTitleIds
      );

    const mockAchievements = [
      generateRaGameExtendedAchievementEntityWithUserProgress({
        ...(mockOriginalAchievements[0] as any),
        dateEarnedHardcore: new Date("2020-01-01").toISOString()
      }),
      generateRaGameExtendedAchievementEntityWithUserProgress({
        ...(mockOriginalAchievements[1] as any)
      })
    ];

    jest.spyOn(dataService, "fetchUserGameProgress").mockResolvedValueOnce(
      generateRaGameInfoAndUserProgress({
        id: Number(mockServiceTitleIds[0]),
        achievements: convertAchievementsListToMap(mockAchievements)
      })
    );

    const newUserGameProgress =
      await retroachievementsService.createRetroachievementsUserGameProgress(
        addedGames[0].id,
        trackedAccount,
        mockServiceTitleIds[0]
      );
    /* -- END: Create the initial user progress */

    // ACT
    // Now we'll have them unlock 1 more achievement.
    const mockAllEarnedAchievementsList = [
      generateRaGameExtendedAchievementEntityWithUserProgress({
        ...(mockOriginalAchievements[0] as any),
        dateEarnedHardcore: new Date("2020-01-01").toISOString()
      }),
      generateRaGameExtendedAchievementEntityWithUserProgress({
        ...(mockOriginalAchievements[1] as any),
        dateEarnedHardcore: new Date("2020-01-01").toISOString()
      })
    ];

    jest.spyOn(dataService, "fetchUserGameProgress").mockResolvedValueOnce(
      generateRaGameInfoAndUserProgress({
        id: Number(mockServiceTitleIds[0]),
        achievements: convertAchievementsListToMap(
          mockAllEarnedAchievementsList
        )
      })
    );

    await retroachievementsService.updateRetroachievementsUserGameProgress(
      newUserGameProgress,
      addedGames[0].id,
      trackedAccount,
      mockServiceTitleIds[0]
    );

    // ASSERT
    const foundTrackedEvent = await db.trackedEvent.findFirst();

    expect(foundTrackedEvent).toBeTruthy();
    expect(foundTrackedEvent.kind).toEqual("RA_NewMastery");
    expect(foundTrackedEvent.trackedAccountId).toEqual(trackedAccount.id);

    const eventData =
      foundTrackedEvent.eventData as RetroachievementsNewMasteryEvent;

    expect(eventData.game.name).toEqual(addedGames[0].name);
    expect(eventData.game.consoleName).toEqual(addedGames[0].gamePlatforms[0]);

    expect(eventData.hardestAchievement.name).toEqual(
      mockAllEarnedAchievementsList[1].title
    );
    expect(eventData.hardestAchievement.points).toEqual(
      mockAllEarnedAchievementsList[1].points
    );
  });

  it("given a user has earned a 100 point achievement for a game they have in progress, tracks an event for the 100 point unlock", async () => {
    // ARRANGE
    /* -- START: Create the initial user progress -- */
    // They've earned 1 of 3 achievements.
    const user = await createUser();

    const trackedAccount = user.trackedAccounts.find(
      (trackedAccount) => trackedAccount.gamingService === "RA"
    );

    await db.trackedAccount.update({
      where: { id: trackedAccount.id },
      data: { createdAt: new Date("2020-01-01") }
    });

    const mockServiceTitleIds = ["12345"];
    const mockOriginalAchievements = [
      generateRaAchievement({ id: 0, points: 10 }),
      generateRaAchievement({ id: 1, points: 100 }),
      generateRaAchievement({ id: 2, points: 10 })
    ];

    const mockServiceTitle = generateRaGameExtended({
      id: Number(mockServiceTitleIds[0]),
      achievements: convertAchievementsListToMap(mockOriginalAchievements)
    });

    jest
      .spyOn(dataService, "fetchDeepGameInfo")
      .mockResolvedValueOnce(mockServiceTitle);

    const retroachievementsService = app.get(RetroachievementsService);

    const addedGames =
      await retroachievementsService.addRetroachievementsTitlesToDb(
        mockServiceTitleIds
      );

    const mockAchievements = [
      generateRaGameExtendedAchievementEntityWithUserProgress({
        id: mockOriginalAchievements[0].id,
        title: mockOriginalAchievements[0].title,
        description: mockOriginalAchievements[0].description,
        points: 10,
        dateEarnedHardcore: new Date("2020-01-01").toISOString()
      }),
      generateRaGameExtendedAchievementEntityWithUserProgress({
        id: mockOriginalAchievements[1].id,
        title: mockOriginalAchievements[1].title,
        description: mockOriginalAchievements[1].description,
        dateEarnedHardcore: undefined,
        points: 100
      }),
      generateRaGameExtendedAchievementEntityWithUserProgress({
        id: mockOriginalAchievements[2].id,
        title: mockOriginalAchievements[2].title,
        description: mockOriginalAchievements[2].description,
        dateEarnedHardcore: undefined,
        points: 10
      })
    ];

    jest.spyOn(dataService, "fetchUserGameProgress").mockResolvedValueOnce(
      generateRaGameInfoAndUserProgress({
        id: Number(mockServiceTitleIds[0]),
        achievements: convertAchievementsListToMap(mockAchievements)
      })
    );

    const newUserGameProgress =
      await retroachievementsService.createRetroachievementsUserGameProgress(
        addedGames[0].id,
        trackedAccount,
        mockServiceTitleIds[0]
      );
    /* -- END: Create the initial user progress */

    // ACT
    // Now we'll have them unlock 1 more achievement.
    const mockAllEarnedAchievementsList = [
      generateRaGameExtendedAchievementEntityWithUserProgress({
        id: mockOriginalAchievements[0].id,
        title: mockOriginalAchievements[0].title,
        description: mockOriginalAchievements[0].description,

        points: 10,
        dateEarnedHardcore: new Date("2020-01-01").toISOString()
      }),
      generateRaGameExtendedAchievementEntityWithUserProgress({
        id: mockOriginalAchievements[1].id,
        title: mockOriginalAchievements[1].title,
        description: mockOriginalAchievements[1].description,
        dateEarnedHardcore: new Date("2020-01-01").toISOString(),
        points: 100
      }),
      generateRaGameExtendedAchievementEntityWithUserProgress({
        id: mockOriginalAchievements[2].id,
        title: mockOriginalAchievements[2].title,
        description: mockOriginalAchievements[2].description,
        points: 10,
        dateEarnedHardcore: undefined
      })
    ];

    jest.spyOn(dataService, "fetchUserGameProgress").mockResolvedValueOnce(
      generateRaGameInfoAndUserProgress({
        id: Number(mockServiceTitleIds[0]),
        achievements: convertAchievementsListToMap(
          mockAllEarnedAchievementsList
        )
      })
    );

    await retroachievementsService.updateRetroachievementsUserGameProgress(
      newUserGameProgress,
      addedGames[0].id,
      trackedAccount,
      mockServiceTitleIds[0]
    );

    // ASSERT
    const foundTrackedEvent = await db.trackedEvent.findFirst();

    expect(foundTrackedEvent).toBeTruthy();
    expect(foundTrackedEvent.kind).toEqual("RA_HundredPointAchievementUnlock");
    expect(foundTrackedEvent.trackedAccountId).toEqual(trackedAccount.id);

    const eventData =
      foundTrackedEvent.eventData as RetroachievementsHundredPointUnlockEvent;

    expect(eventData.game.name).toEqual(addedGames[0].name);
    expect(eventData.game.consoleName).toEqual(addedGames[0].gamePlatforms[0]);

    expect(eventData.achievement.name).toEqual(
      mockAllEarnedAchievementsList[1].title
    );
    expect(eventData.achievement.description).toEqual(
      mockAllEarnedAchievementsList[1].description
    );
    expect(eventData.achievement.serviceAchievementId).toEqual(
      String(mockAllEarnedAchievementsList[1].id)
    );
  });
});
