import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { createUser } from "@achievements-app/utils-db";
import { generateMappedCompleteGame } from "@achievements-app/utils-model-generators";

import { DbService } from "@/api/shared/db/db.service";

import { PublicModule } from "./public.module";
import { PublicService } from "./public.service";

describe("Service: PublicService", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PublicModule]
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
    const publicService = app.get(PublicService);

    // ASSERT
    expect(publicService).toBeTruthy();
  });

  it("given a TrackedAccount entity, can return all its PublicUserGameProgress entities", async () => {
    // ARRANGE
    // Start by adding a user, a game, and some user progress.
    const mockMappedCompleteGame = generateMappedCompleteGame({
      gamingService: "PSN"
    });
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

    const publicService = app.get(PublicService);

    // ACT
    const allPublicUserGameProgress =
      await publicService.getAllTrackedAccountPublicUserGameProgress(
        neededTrackedAccount
      );

    // ASSERT
    expect(allPublicUserGameProgress.length).toEqual(1);

    const publicUserGameProgress = allPublicUserGameProgress[0];

    expect(publicUserGameProgress.name).toEqual(storedGame.name);
    expect(publicUserGameProgress.platforms).toEqual(storedGame.gamePlatforms);
    expect(publicUserGameProgress.gamingService).toEqual("PSN");
    expect(publicUserGameProgress.imageUrl).toEqual(storedGame.coverImageUrl);
    expect(publicUserGameProgress.completedOn).toEqual(null);
  });

  it("given a TrackedAccount entity, correctly tallies total possible points for RA titles", async () => {
    // ARRANGE
    // Start by adding a user, a game, and some user progress.
    const mockMappedCompleteGame = generateMappedCompleteGame(
      {
        gamingService: "RA"
      },
      { achievementCount: 2 }
    );
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

    const publicService = app.get(PublicService);

    // ACT
    const allPublicUserGameProgress =
      await publicService.getAllTrackedAccountPublicUserGameProgress(
        neededTrackedAccount
      );

    // ASSERT
    expect(allPublicUserGameProgress.length).toEqual(1);

    const publicUserGameProgress = allPublicUserGameProgress[0];

    // The user has 2 of 2 achievements.
    expect(publicUserGameProgress.completedOn).not.toEqual(null);

    expect(publicUserGameProgress.gameTotalPossiblePoints).toEqual(
      mockMappedCompleteGame.achievements[0].vanillaPoints +
        mockMappedCompleteGame.achievements[1].vanillaPoints
    );
  });
});
