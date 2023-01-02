import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { db } from "@achievements-app/data-access-db";
import { createGame, createUser } from "@achievements-app/utils-db";
import { generateMappedGame } from "@achievements-app/utils-model-generators";

import { DbService } from "@/api/shared/db/db.service";

import * as FetchTitleAchievementsModule from "./queries/fetchTitleAchievements";
import * as FetchTitleHistoryByXuidModule from "./queries/fetchTitleHistoryByXuid";
import * as FetchTitleMetadataModule from "./queries/fetchTitleMetadata";
import * as xboxApiMocks from "./utils/xboxApiMocks";
import { XboxModule } from "./xbox.module";
import { XboxService } from "./xbox.service";
import { XboxDataService } from "./xbox-data.service";

describe("Service: XboxService", () => {
  let app: INestApplication;
  let dataService: XboxDataService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [XboxModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    dataService = app.get(XboxDataService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    const dbService = app.get(DbService);
    await dbService.enableShutdownHooks(app);

    await app.close();
  });

  it("can instantiate #sanity", () => {
    // ARRANGE
    const xboxService = app.get(XboxService);

    // ASSERT
    expect(xboxService).toBeTruthy();
  });

  it("given a user XUID and a list of title IDs, can fetch the titles from Xbox and store their metadatas in our DB", async () => {
    const mockServiceTitleIds = ["12345"];
    const mockServiceTitle = xboxApiMocks.generateXboxDeepGameInfo(
      {
        titleId: mockServiceTitleIds[0]
      },
      { unearnedAchievementCount: 1 }
    );
    const mockUserGames = [
      generateMappedGame({ serviceTitleId: mockServiceTitleIds[0] })
    ];

    jest
      .spyOn(dataService, "fetchDeepGameInfo")
      .mockResolvedValueOnce(mockServiceTitle);

    const xboxService = app.get(XboxService);

    // ACT
    const addedGames = await xboxService.addXboxTitlesToDb(
      "mockUserXuid",
      mockServiceTitleIds,
      mockUserGames
    );

    // ASSERT
    expect(addedGames.length).toEqual(1);

    const addedGame = await db.game.findFirst({
      include: { achievements: true }
    });

    expect(addedGame.name).toEqual(mockServiceTitle.name);
    expect(addedGame.serviceTitleId).toEqual(mockServiceTitleIds[0]);
    expect(addedGame.gamingService).toEqual("XBOX");
    expect(addedGame.achievements.length).toEqual(
      mockServiceTitle.achievements.length
    );

    expect(addedGame.achievements[0].vanillaPoints).toEqual(
      mockServiceTitle.achievements[0].gamerscore
    );
  });

  it("can retrieve and create a new UserGameProgress entity for a given TrackedAccount", async () => {
    // ARRANGE
    const user = await createUser();
    const trackedAccount = user.trackedAccounts.find(
      (trackedAccount) => trackedAccount.gamingService === "XBOX"
    );

    const mockServiceTitleIds = ["12345"];
    const mockServiceTitle = xboxApiMocks.generateXboxDeepGameInfo(
      {
        titleId: mockServiceTitleIds[0]
      },
      { unearnedAchievementCount: 2, earnedAchievementCount: 1 }
    );
    const mockUserGames = [
      generateMappedGame({ serviceTitleId: mockServiceTitleIds[0] })
    ];

    jest
      .spyOn(dataService, "fetchDeepGameInfo")
      .mockResolvedValue(mockServiceTitle);

    const xboxService = app.get(XboxService);

    const addedGames = await xboxService.addXboxTitlesToDb(
      "mockUserXuid",
      mockServiceTitleIds,
      mockUserGames
    );

    // ACT
    const newUserGameProgress = await xboxService.createXboxUserGameProgress(
      addedGames[0],
      trackedAccount
    );

    // ASSERT
    expect(newUserGameProgress).toBeTruthy();
    expect(newUserGameProgress.gameId).toEqual(addedGames[0].id);
    expect(newUserGameProgress.trackedAccountId).toEqual(trackedAccount.id);

    const completeUserGameProgress = await db.userGameProgress.findFirst({
      include: { earnedAchievements: true }
    });

    expect(completeUserGameProgress.earnedAchievements.length).toEqual(1);
  });

  it("given a user XUID and gamertag, can determine which of the user's games are missing and/or stored in our DB", async () => {
    // ARRANGE
    const storedGame = await createGame({
      gamingService: "XBOX",
      serviceTitleId: "12345"
    });

    jest
      .spyOn(dataService, "fetchCompleteTitleHistoryByXuid")
      .mockResolvedValueOnce([
        xboxApiMocks.generateXboxSanitizedTitleHistoryEntity(),
        xboxApiMocks.generateXboxSanitizedTitleHistoryEntity(),
        xboxApiMocks.generateXboxSanitizedTitleHistoryEntity({
          titleId: Number(storedGame.serviceTitleId)
        })
      ]);

    const xboxService = app.get(XboxService);

    // ACT
    const {
      allUserGames,
      existingGameServiceTitleIds,
      missingGameServiceTitleIds,
      staleGameServiceTitleIds
    } = await xboxService.getMissingAndPresentUserXboxGames(
      "mockXuid",
      "mockGamertag"
    );

    // ASSERT
    expect(allUserGames.length).toEqual(3);
    expect(staleGameServiceTitleIds.length).toEqual(0);
    expect(missingGameServiceTitleIds.length).toEqual(2);
    expect(existingGameServiceTitleIds.length).toEqual(1);
  });
});
