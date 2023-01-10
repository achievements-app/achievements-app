import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { db } from "@achievements-app/data-access-db";
import { createGame, createUser } from "@achievements-app/utils-db";
import {
  generateMappedCompleteGame,
  generateMappedGameAchievement
} from "@achievements-app/utils-model-generators";

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

  describe("Method: addMappedCompleteGame", () => {
    it("given a MappedCompleteGame entity, stores it and its achievements in the DB", async () => {
      // ARRANGE
      const mockMappedCompleteGame = generateMappedCompleteGame();

      const dbService = app.get(DbService);

      // ACT
      await dbService.addMappedCompleteGame(mockMappedCompleteGame);

      // ASSERT
      const foundAddedGame = await db.game.findFirst({
        where: { serviceTitleId: mockMappedCompleteGame.serviceTitleId },
        include: { achievements: true }
      });

      expect(foundAddedGame).toBeTruthy();
      expect(foundAddedGame.achievements.length).toEqual(
        mockMappedCompleteGame.achievements.length
      );
    });
  });

  describe("Method: addNewUserGameProgress", () => {
    it("given a list of MappedGameAchievement entities, can store account progress for a given game", async () => {
      // ARRANGE
      const mockMappedCompleteGame = generateMappedCompleteGame();
      const mockServiceEarnedAchievements = [
        mockMappedCompleteGame.achievements[0],
        mockMappedCompleteGame.achievements[1]
      ];

      const dbService = app.get(DbService);

      const storedUser = await createUser();
      const storedGame = await dbService.addMappedCompleteGame(
        mockMappedCompleteGame
      );

      // ACT
      const neededTrackedAccount = storedUser.trackedAccounts.find(
        (trackedAccount) =>
          trackedAccount.gamingService === storedGame.gamingService
      );

      await dbService.addNewUserGameProgress(
        storedGame.id,
        neededTrackedAccount,
        mockServiceEarnedAchievements
      );

      // ASSERT
      const foundUserGameProgress = await db.userGameProgress.findFirst({
        where: { gameId: storedGame.id },
        include: { earnedAchievements: true }
      });

      expect(foundUserGameProgress.trackedAccountId).toEqual(
        neededTrackedAccount.id
      );

      expect(foundUserGameProgress.earnedAchievements.length).toEqual(2);
    });

    it("given a MappedGameAchievement is reported but not present in our DB, marks the game as stale", async () => {
      // ARRANGE
      // eslint-disable-next-line no-console -- suppress the throw error message.
      console.error = jest.fn();

      const mockMappedCompleteGame = generateMappedCompleteGame();
      const mockServiceEarnedAchievements = [
        mockMappedCompleteGame.achievements[0],
        mockMappedCompleteGame.achievements[1],
        generateMappedGameAchievement()
      ];

      const dbService = app.get(DbService);

      const storedUser = await createUser();
      const storedGame = await dbService.addMappedCompleteGame(
        mockMappedCompleteGame
      );

      // ACT
      const neededTrackedAccount = storedUser.trackedAccounts.find(
        (trackedAccount) =>
          trackedAccount.gamingService === storedGame.gamingService
      );

      await dbService.addNewUserGameProgress(
        storedGame.id,
        neededTrackedAccount,
        mockServiceEarnedAchievements
      );

      // ASSERT
      const foundGame = await db.game.findFirst({
        where: { id: storedGame.id }
      });

      expect(foundGame).toBeTruthy();
      expect(foundGame.isStale).toEqual(true);
    });
  });

  describe("Method: findAllStoredGameAchievements", () => {
    it("given a game ID, returns all the known achievements associated with that game", async () => {
      // ARRANGE
      const mockMappedCompleteGame = generateMappedCompleteGame(undefined, {
        achievementCount: 1
      });

      const dbService = app.get(DbService);

      const storedGame = await dbService.addMappedCompleteGame(
        mockMappedCompleteGame
      );

      // ACT
      const allStoredGameAchievements =
        await dbService.findAllStoredGameAchievements(storedGame.id);

      // ASSERT
      expect(allStoredGameAchievements.length).toEqual(1);

      expect(allStoredGameAchievements[0].serviceAchievementId).toEqual(
        mockMappedCompleteGame.achievements[0].serviceAchievementId
      );
    });
  });

  describe("Method: findCompleteUserGameProgress", () => {
    it("given a TrackedAccount ID and a stored Game ID, returns an associated UserGameProgress", async () => {
      // ARRANGE
      const mockMappedCompleteGame = generateMappedCompleteGame();
      const mockServiceEarnedAchievements = [
        mockMappedCompleteGame.achievements[0],
        mockMappedCompleteGame.achievements[1]
      ];

      const dbService = app.get(DbService);

      const storedUser = await createUser();
      const storedGame = await dbService.addMappedCompleteGame(
        mockMappedCompleteGame
      );

      const neededTrackedAccount = storedUser.trackedAccounts.find(
        (trackedAccount) =>
          trackedAccount.gamingService === storedGame.gamingService
      );

      await dbService.addNewUserGameProgress(
        storedGame.id,
        neededTrackedAccount,
        mockServiceEarnedAchievements
      );

      // ACT
      const thinUserGameProgress = await dbService.findThinUserGameProgress(
        neededTrackedAccount.id,
        storedGame.id
      );

      const completeUserGameProgress = await db.userGameProgress.findFirst({
        where: { id: thinUserGameProgress.id },
        include: { earnedAchievements: true }
      });

      // ASSERT
      expect(completeUserGameProgress).toBeTruthy();
      expect(completeUserGameProgress.earnedAchievements.length).toEqual(2);
    });
  });

  describe("Method: getMultipleGamesExistenceStatus", () => {
    it("given a list of serviceTitleIds, returns a list of games that are missing", async () => {
      // ARRANGE
      const mockServiceTitleIds = ["12345", "23456", "34567", "45678"];

      const dbService = app.get(DbService);

      // ACT
      const { missingGameServiceTitleIds } =
        await dbService.getMultipleGamesExistenceStatus(
          "RA",
          mockServiceTitleIds
        );

      // ASSERT
      expect(missingGameServiceTitleIds).toEqual(mockServiceTitleIds);
    });

    it("given a list of serviceTitleIds, returns a list of games that exist in the database", async () => {
      // ARRANGE
      const mockServiceTitleIds = ["12345", "23456", "34567", "45678"];

      await db.$transaction([
        createGame({
          serviceTitleId: mockServiceTitleIds[0],
          gamingService: "RA"
        }),
        createGame({
          serviceTitleId: mockServiceTitleIds[1],
          gamingService: "RA"
        }),
        createGame({
          serviceTitleId: mockServiceTitleIds[2],
          // Intentionally using the wrong service, so this
          // title ID should show up as missing.
          gamingService: "XBOX"
        })
      ]);

      const dbService = app.get(DbService);

      // ACT
      const { existingGameServiceTitleIds, missingGameServiceTitleIds } =
        await dbService.getMultipleGamesExistenceStatus(
          "RA",
          mockServiceTitleIds
        );

      // ASSERT
      expect(existingGameServiceTitleIds).toContain(mockServiceTitleIds[0]);
      expect(existingGameServiceTitleIds).toContain(mockServiceTitleIds[1]);

      expect(missingGameServiceTitleIds).toContain(mockServiceTitleIds[2]);
      expect(missingGameServiceTitleIds).toContain(mockServiceTitleIds[3]);
    });

    it("given a list of serviceTitleIds, returns a list of games that exist but are flagged as stale", async () => {
      // ARRANGE
      const mockServiceTitleIds = ["12345", "23456", "34567", "45678"];

      await db.$transaction([
        createGame({
          serviceTitleId: mockServiceTitleIds[0],
          gamingService: "RA"
        }),
        createGame({
          serviceTitleId: mockServiceTitleIds[1],
          gamingService: "RA",
          isStale: true
        }),
        createGame({
          serviceTitleId: mockServiceTitleIds[2],
          // Intentionally using the wrong service, so this
          // title ID should show up as missing.
          gamingService: "XBOX"
        })
      ]);

      const dbService = app.get(DbService);

      // ACT
      const { existingGameServiceTitleIds, staleGameServiceTitleIds } =
        await dbService.getMultipleGamesExistenceStatus(
          "RA",
          mockServiceTitleIds
        );

      // ASSERT
      expect(existingGameServiceTitleIds).toContain(mockServiceTitleIds[0]);
      expect(existingGameServiceTitleIds).not.toContain(mockServiceTitleIds[1]);

      expect(staleGameServiceTitleIds).not.toContain(mockServiceTitleIds[0]);
      expect(staleGameServiceTitleIds).toContain(mockServiceTitleIds[1]);
    });
  });

  describe("Method: markGameAsStale", () => {
    it("given a gameId, flags the game as being stale", async () => {
      // ARRANGE
      const newGame = await createGame({ isStale: false });

      const dbService = app.get(DbService);

      // ACT
      const updatedGame = await dbService.markGameAsStale(newGame.id);

      // ASSERT
      expect(updatedGame.isStale).toEqual(true);
    });
  });

  describe("Method: updateExistingUserGameProgress", () => {
    it("given the user earns a new achievement for a game, updates the associated UserGameProgress entity to reflect this", async () => {
      // ARRANGE
      // Set up a fresh UserGameProgress entity.
      const mockMappedCompleteGame = generateMappedCompleteGame();
      const mockServiceEarnedAchievements = [
        mockMappedCompleteGame.achievements[0],
        mockMappedCompleteGame.achievements[1]
      ];

      const dbService = app.get(DbService);

      const storedUser = await createUser();
      const storedGame = await dbService.addMappedCompleteGame(
        mockMappedCompleteGame
      );

      const neededTrackedAccount = storedUser.trackedAccounts.find(
        (trackedAccount) =>
          trackedAccount.gamingService === storedGame.gamingService
      );

      const { newUserGameProgress } = await dbService.addNewUserGameProgress(
        storedGame.id,
        neededTrackedAccount,
        mockServiceEarnedAchievements
      );

      // ACT
      // Try to update the UserGameProgress, reporting the user has earned a new achievement.
      mockServiceEarnedAchievements.push(
        mockMappedCompleteGame.achievements[2]
      );

      const { updatedUserGameProgress } =
        await dbService.updateExistingUserGameProgress(
          newUserGameProgress,
          mockServiceEarnedAchievements
        );

      const completeUserGameProgress = await db.userGameProgress.findFirst({
        where: { id: updatedUserGameProgress.id },
        include: { earnedAchievements: true }
      });

      // ASSERT
      expect(completeUserGameProgress.earnedAchievements.length).toEqual(3);
    });

    it("given a reported achievement is missing from our DB for a game, throws an error", async () => {
      // ARRANGE
      // Set up a fresh UserGameProgress entity.
      const mockMappedCompleteGame = generateMappedCompleteGame();
      const mockServiceEarnedAchievements = [
        mockMappedCompleteGame.achievements[0],
        mockMappedCompleteGame.achievements[1]
      ];

      const dbService = app.get(DbService);

      const storedUser = await createUser();
      const storedGame = await dbService.addMappedCompleteGame(
        mockMappedCompleteGame
      );

      const neededTrackedAccount = storedUser.trackedAccounts.find(
        (trackedAccount) =>
          trackedAccount.gamingService === storedGame.gamingService
      );

      const { newUserGameProgress } = await dbService.addNewUserGameProgress(
        storedGame.id,
        neededTrackedAccount,
        mockServiceEarnedAchievements
      );

      // ACT
      // Try to update the UserGameProgress, reporting the user has earned a new achievement.
      mockServiceEarnedAchievements.push(
        // !! This is a new and unknown achievement.
        generateMappedGameAchievement()
      );

      // ASSERT
      await expect(
        dbService.updateExistingUserGameProgress(
          newUserGameProgress,
          mockServiceEarnedAchievements
        )
      ).rejects.toThrow(Error("Missing achievement"));
    });
  });

  describe("Method: updateMappedCompleteGame", () => {
    it("given a MappedCompleteGame entity, finds its existing record in the database and updates it", async () => {
      // ARRANGE
      const dbService = app.get(DbService);

      const mockMappedCompleteGame = generateMappedCompleteGame();
      await dbService.addMappedCompleteGame(mockMappedCompleteGame);

      // ACT
      mockMappedCompleteGame.name += " (Anniversary Edition)";
      mockMappedCompleteGame.achievements[0].vanillaPoints = 999;
      mockMappedCompleteGame.achievements.push(generateMappedGameAchievement());

      await dbService.updateMappedCompleteGame(mockMappedCompleteGame);

      // ASSERT
      const updatedGame = await db.game.findFirst({
        include: { achievements: true },
        where: {
          serviceTitleId: mockMappedCompleteGame.serviceTitleId
        }
      });

      expect(updatedGame.name).toContain("(Anniversary Edition)");

      const foundUpdatedAchievement = updatedGame.achievements.find(
        (achievement) => achievement.vanillaPoints === 999
      );
      expect(foundUpdatedAchievement).toBeTruthy();

      expect(updatedGame.achievements.length).toEqual(6);
    });
  });
});
