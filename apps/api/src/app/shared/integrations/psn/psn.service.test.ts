import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { db } from "@achievements-app/data-access-db";
import { createGame, createUser } from "@achievements-app/utils-db";
import {
  generateMappedCompleteGame,
  generateMappedGame
} from "@achievements-app/utils-model-generators";

import { DbService } from "@/api/shared/db/db.service";

import { PsnModule } from "./psn.module";
import { PsnService } from "./psn.service";
import { PsnDataService } from "./psn-data.service";
import * as psnApiMocks from "./utils/psnApiMocks";

describe("Service: PsnService", () => {
  let app: INestApplication;
  let dataService: PsnDataService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PsnModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    dataService = app.get(PsnDataService);
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
    const psnService = app.get(PsnService);

    // ASSERT
    expect(psnService).toBeTruthy();
  });

  it("given a PSN account ID and a PSN user name, can determine which of the user's games are missing and/or stored in our DB", async () => {
    // ARRANGE
    await createGame({
      gamingService: "PSN",
      serviceTitleId: "0" // Our mock generates title IDs starting at 0.
    });

    jest
      .spyOn(dataService, "fetchTitleHistoryByAccountId")
      .mockResolvedValueOnce(
        psnApiMocks.generateUserTitlesResponse(undefined, {
          visibleTitleCount: 3,
          hiddenTitleCount: 0
        })
      );

    const psnService = app.get(PsnService);

    // ACT
    const {
      allUserGames,
      existingGameServiceTitleIds,
      missingGameServiceTitleIds
    } = await psnService.getMissingAndPresentUserPsnGames(
      "mockUserAccountId",
      "mockUserName"
    );

    // ASSERT
    expect(allUserGames.length).toEqual(3);
    expect(existingGameServiceTitleIds.length).toEqual(1);
    expect(missingGameServiceTitleIds.length).toEqual(2);
  });

  it("given a TrackedAccount and MappedGame entity, can find the game metadata and user progress and store it in our DB", async () => {
    // ARRANGE
    const addedUser = await createUser();
    const trackedAccount = addedUser.trackedAccounts.find(
      (trackedAccount) => trackedAccount.gamingService === "PSN"
    );

    const mockMappedGame = generateMappedGame({
      gamingService: "PSN",
      psnServiceName: "trophy"
    });

    jest
      .spyOn(dataService, "fetchAllTitleTrophies")
      .mockResolvedValueOnce(psnApiMocks.generateTitleTrophiesResponse());

    jest
      .spyOn(dataService, "fetchUserEarnedTrophiesForTitle")
      .mockResolvedValueOnce(
        psnApiMocks.generateUserTrophiesEarnedForTitleResponse(undefined, {
          earnedTrophyCount: 2,
          unearnedTrophyCount: 1
        })
      );

    const psnService = app.get(PsnService);

    // ACT
    const { addedGame, newUserGameProgress } =
      await psnService.addPsnTitleAndProgressToDb(
        trackedAccount,
        mockMappedGame
      );

    // ASSERT
    expect(addedGame.serviceTitleId).toEqual(mockMappedGame.serviceTitleId);
    expect(addedGame.gamingService).toEqual("PSN");
    expect(addedGame.name).toEqual(mockMappedGame.name);
    expect(addedGame.psnServiceName).toEqual(mockMappedGame.psnServiceName);

    expect(newUserGameProgress.trackedAccountId).toEqual(trackedAccount.id);
    expect(newUserGameProgress.gameId).toEqual(addedGame.id);
    expect(newUserGameProgress.earnedAchievements.length).toEqual(2);
  });

  it("given a TrackedAccount does not have a stored PSN account ID, retrieves the account ID from PSN and stores it", async () => {
    // ARRANGE
    const user = await createUser();
    const trackedAccount = user.trackedAccounts.find(
      (trackedAccount) => trackedAccount.gamingService === "PSN"
    );

    jest
      .spyOn(dataService, "fetchAccountIdFromUserName")
      .mockResolvedValueOnce("foundAccountIdFromPsn");

    const psnService = app.get(PsnService);

    // ACT
    const trackedAccountWithPsnAccountId =
      await psnService.useTrackedAccountPsnAccountId(trackedAccount);

    // ASSERT
    expect(trackedAccountWithPsnAccountId.serviceAccountId).toEqual(
      "foundAccountIdFromPsn"
    );

    const storedTrackedAccount = await db.trackedAccount.findUnique({
      where: { id: trackedAccount.id }
    });

    expect(storedTrackedAccount.serviceAccountId).toEqual(
      "foundAccountIdFromPsn"
    );
  });

  it("given a TrackedAccount already has a stored PSN account ID, returns that stored account ID", async () => {
    // ARRANGE
    const user = await createUser();
    const trackedAccount = user.trackedAccounts.find(
      (trackedAccount) => trackedAccount.gamingService === "PSN"
    );

    await db.trackedAccount.update({
      where: { id: trackedAccount.id },
      data: { serviceAccountId: "mockServiceAccountId" }
    });

    const updatedTrackedAccount = await db.trackedAccount.findUnique({
      where: { id: trackedAccount.id }
    });

    const fetchAccountIdFromUserNameSpy = jest.spyOn(
      dataService,
      "fetchAccountIdFromUserName"
    );

    const psnService = app.get(PsnService);

    // ACT
    const trackedAccountWithPsnAccountId =
      await psnService.useTrackedAccountPsnAccountId(updatedTrackedAccount);

    // ASSERT
    expect(trackedAccountWithPsnAccountId.serviceAccountId).toEqual(
      "mockServiceAccountId"
    );

    expect(fetchAccountIdFromUserNameSpy).not.toHaveBeenCalled();
  });
});
