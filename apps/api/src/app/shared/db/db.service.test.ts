import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { db, dbUtils } from "@achievements-app/data-access-db";

import { generateAchievement } from "../integrations/retroachievements/utils/generateAchievement";
import { generateGameInfoAndUserProgress } from "../integrations/retroachievements/utils/generateGameInfoAndUserProgress";
import { generateUserGameCompletion } from "../integrations/retroachievements/utils/generateUserGameCompletion";
import { DbModule } from "./db.module";
import { DbService } from "./db.service";

describe("Service: DbService", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DbModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    const dbService = app.get(DbService);
    await dbService.db.$reset();
  });

  afterAll(async () => {
    const dbService = app.get(DbService);
    await dbService.enableShutdownHooks(app);

    await app.close();
  });

  it("can instantiate #sanity", () => {
    // ARRANGE
    const dbService = app.get(DbService);

    // ASSERT
    expect(dbService).toBeTruthy();
  });

  it("can add a new UserGameProgress entity for a RetroAchievements GameInfoAndUserProgress record", async () => {
    // ARRANGE
    const mockServiceTitleId = "12345";

    const newGame = await dbUtils.addGame(1, {
      gamingService: "RA",
      serviceTitleId: mockServiceTitleId
    });

    const newUser = await dbUtils.addRandomUser();
    const newTrackedAccount = await dbUtils.addTrackedAccount({
      gamingService: "RA",
      userId: newUser.id
    });

    const mockGameInfoAndUserProgress = generateGameInfoAndUserProgress(
      {
        id: Number(mockServiceTitleId)
      },
      {
        earnedAchievementIds: [
          Number(newGame.achievements[0].serviceAchievementId)
        ]
      }
    );

    const dbService = app.get(DbService);

    // ACT
    await dbService.addNewRetroachievementsUserGameProgress(
      newGame.id,
      newTrackedAccount,
      mockGameInfoAndUserProgress
    );

    const newUserGameProgress = await db.userGameProgress.findFirst({
      include: {
        earnedAchievements: true,
        game: true,
        trackedAccount: true
      }
    });

    // ASSERT
    expect(newUserGameProgress).toBeTruthy();

    expect(newUserGameProgress.trackedAccountId).toEqual(newTrackedAccount.id);
    expect(newUserGameProgress.earnedAchievements.length).toEqual(1);
    expect(newUserGameProgress.game.id).toEqual(newGame.id);
  });

  it("can update an existing UserGameProgress entity for a RetroAchievements set", async () => {
    // For this test, we'll have a game that has two achievements.
    // Initially, the user has earned one of them. Afterwards,
    // we'll make an update where they've earned them both.
    // The database should reflect that both have been earned.

    // ARRANGE
    const mockServiceTitleId = "12345";

    const newGame = await dbUtils.addGame(2, {
      gamingService: "RA",
      serviceTitleId: mockServiceTitleId
    });

    const newUser = await dbUtils.addRandomUser();
    const newTrackedAccount = await dbUtils.addTrackedAccount({
      gamingService: "RA",
      userId: newUser.id
    });

    // The user is missing one of the achievements.
    const mockGameInfoAndUserProgress = generateGameInfoAndUserProgress(
      {
        id: Number(mockServiceTitleId)
      },
      {
        earnedAchievementIds: [
          Number(newGame.achievements[0].serviceAchievementId)
        ],
        unearnedAchievementIds: [
          Number(newGame.achievements[1].serviceAchievementId)
        ]
      }
    );

    const dbService = app.get(DbService);

    const existingUserGameProgress =
      await dbService.addNewRetroachievementsUserGameProgress(
        newGame.id,
        newTrackedAccount,
        mockGameInfoAndUserProgress
      );

    // ACT
    // Now the user has earned both of the achievements.
    const updatedMockGameInfoAndUserProgress = generateGameInfoAndUserProgress(
      { id: Number(mockServiceTitleId) },
      {
        earnedAchievementIds: [
          Number(newGame.achievements[0].serviceAchievementId),
          Number(newGame.achievements[1].serviceAchievementId)
        ]
      }
    );

    const updatedUserGameProgress =
      await dbService.updateExistingRetroachievementsUserGameProgress(
        existingUserGameProgress,
        updatedMockGameInfoAndUserProgress.achievements,
        newGame.achievements
      );

    // ASSERT
    expect(updatedUserGameProgress).toBeTruthy();
    expect(updatedUserGameProgress.earnedAchievements.length).toEqual(2);
  });

  it("can purge the earned achievements belonging to a UserGameProgress entity", async () => {
    const mockServiceTitleId = "12345";

    const newGame = await dbUtils.addGame(1, {
      gamingService: "RA",
      serviceTitleId: mockServiceTitleId
    });

    const newUser = await dbUtils.addRandomUser();
    const newTrackedAccount = await dbUtils.addTrackedAccount({
      gamingService: "RA",
      userId: newUser.id
    });

    const mockGameInfoAndUserProgress = generateGameInfoAndUserProgress(
      {
        id: Number(mockServiceTitleId)
      },
      {
        earnedAchievementIds: [
          Number(newGame.achievements[0].serviceAchievementId)
        ]
      }
    );

    const dbService = app.get(DbService);

    const userGameProgress =
      await dbService.addNewRetroachievementsUserGameProgress(
        newGame.id,
        newTrackedAccount,
        mockGameInfoAndUserProgress
      );

    // ACT
    await dbService.cleanUserGameProgress(userGameProgress);

    const updatedUserGameProgress = await db.userGameProgress.findFirst({
      include: {
        earnedAchievements: true
      }
    });

    // ASSERT
    expect(updatedUserGameProgress).toBeTruthy();
    expect(updatedUserGameProgress.earnedAchievements.length).toEqual(0);
  });

  it("given a set of achievements and a UserGameCompletion can upsert a RetroAchievements game and its achievements set", async () => {
    // ARRANGE
    const mockUserGameCompletion = generateUserGameCompletion();

    const mockGameAchievements = [generateAchievement(), generateAchievement()];

    const dbService = app.get(DbService);

    // ACT
    await dbService.upsertRetroachievementsGame(
      mockUserGameCompletion,
      mockGameAchievements
    );

    const foundGame = await db.game.findFirst({
      where: { serviceTitleId: String(mockUserGameCompletion.gameId) },
      include: { achievements: true }
    });

    // ASSERT
    expect(foundGame).toBeTruthy();

    expect(foundGame.gamingService).toEqual("RA");
    expect(foundGame.serviceTitleId).toEqual(
      String(mockUserGameCompletion.gameId)
    );

    expect(foundGame.achievements.length).toEqual(2);

    expect(foundGame.achievements[0].name).toEqual(
      mockGameAchievements[0].title
    );
    expect(foundGame.achievements[0].vanillaPoints).toEqual(
      mockGameAchievements[0].points
    );
  });
});
