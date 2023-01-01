import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { db } from "@achievements-app/data-access-db";
import { createGame, createUser } from "@achievements-app/utils-db";
import {
  generateRaGameInfoAndUserProgress,
  generateRaGameInfoExtended,
  generateRaUserGameCompletion
} from "@achievements-app/utils-model-generators";

import { DbService } from "@/api/shared/db/db.service";

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

  it("given a set of title IDs, can fetch the title from RetroAchievements and store its metadata in our DB", async () => {
    // ARRANGE
    const mockServiceTitleIds = ["12345"];
    const mockServiceTitle = generateRaGameInfoExtended(
      {
        id: Number(mockServiceTitleIds[0])
      },
      { achievementCount: 1 }
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
      mockServiceTitle.achievements.length
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
    const mockServiceTitle = generateRaGameInfoExtended(
      {
        id: Number(mockServiceTitleIds[0])
      },
      { achievementCount: 3 }
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
          { earnedAchievementCount: 2 }
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

  it("given a RetroAchievements username, can determine which of the user's games are missing and/or stored in our DB", async () => {
    // ARRANGE
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
        "mockUserName"
      );

    // ASSERT
    expect(allUserGames.length).toEqual(3);
    expect(staleGameServiceTitleIds.length).toEqual(0);
    expect(missingGameServiceTitleIds.length).toEqual(2);
    expect(existingGameServiceTitleIds).toEqual([storedGame.serviceTitleId]);
  });

  it("while fetching a list of user's games, informs the caller of which games in the DB are stale", async () => {
    // ARRANGE
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
        "mockUserName"
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

    const mockServiceTitle = generateRaGameInfoExtended({
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
});
