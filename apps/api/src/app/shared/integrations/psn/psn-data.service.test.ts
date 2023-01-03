import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import dayjs from "dayjs";
import * as PsnApiModule from "psn-api";

import { DbService } from "@/api/shared/db/db.service";

import { PsnModule } from "./psn.module";
import { PsnAuthService } from "./psn-auth.service";
import { PsnDataService } from "./psn-data.service";

describe("Service: PsnDataService", () => {
  let app: INestApplication;
  let authService: PsnAuthService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PsnModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    authService = app.get(PsnAuthService);
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
    const psnDataService = app.get(PsnDataService);

    // ASSERT
    expect(psnDataService).toBeTruthy();
  });

  it("given a title ID and title schema, can fetch a list of trophies associated with the title", async () => {
    // ARRANGE
    const psnDataService = app.get(PsnDataService);

    const mockPsnAuthorization = {
      accessToken: "mockAccessToken",
      refreshToken: "mockRefreshToken",
      accessTokenExpiresOn: dayjs().add(1, "year").toISOString(),
      refreshTokenExpiresOn: dayjs().add(1, "year").toISOString()
    };

    jest
      .spyOn(authService, "usePsnAuthorization")
      .mockResolvedValueOnce(mockPsnAuthorization);

    const getTitleTrophiesSpy = jest
      .spyOn(PsnApiModule, "getTitleTrophies")
      .mockResolvedValueOnce({
        trophies: [],
        hasTrophyGroups: false,
        totalItemCount: 0,
        trophySetVersion: "1"
      });

    // ACT
    await psnDataService.fetchAllTitleTrophies("mockPsnTitleId", "trophy");

    // ASSERT
    expect(getTitleTrophiesSpy).toHaveBeenCalledWith(
      mockPsnAuthorization,
      "mockPsnTitleId",
      "all",
      { npServiceName: "trophy" }
    );
  });

  it("given a PSN account ID, title ID, and title schema, can fetch the trophies a user has earned for a title", async () => {
    // ARRANGE
    const psnDataService = app.get(PsnDataService);

    const mockPsnAuthorization = {
      accessToken: "mockAccessToken",
      refreshToken: "mockRefreshToken",
      accessTokenExpiresOn: dayjs().add(1, "year").toISOString(),
      refreshTokenExpiresOn: dayjs().add(1, "year").toISOString()
    };

    jest
      .spyOn(authService, "usePsnAuthorization")
      .mockResolvedValue(mockPsnAuthorization);

    const getUserTrophiesEarnedForTitleSpy = jest
      .spyOn(PsnApiModule, "getUserTrophiesEarnedForTitle")
      .mockResolvedValueOnce({
        trophies: [],
        trophySetVersion: "1",
        hasTrophyGroups: false,
        totalItemCount: 0,
        lastUpdatedDateTime: new Date().toISOString()
      });

    // ACT
    await psnDataService.fetchUserEarnedTrophiesForTitle(
      "mockAccountId",
      "mockServiceTitleId",
      "trophy"
    );

    // ASSERT
    expect(getUserTrophiesEarnedForTitleSpy).toHaveBeenCalledWith(
      mockPsnAuthorization,
      "mockAccountId",
      "mockServiceTitleId",
      "all",
      { npServiceName: "trophy" }
    );
  });

  it("given a PSN account ID, can fetch its associated title history", async () => {
    // ARRANGE
    const psnDataService = app.get(PsnDataService);

    const mockPsnAuthorization = {
      accessToken: "mockAccessToken",
      refreshToken: "mockRefreshToken",
      accessTokenExpiresOn: dayjs().add(1, "year").toISOString(),
      refreshTokenExpiresOn: dayjs().add(1, "year").toISOString()
    };

    jest
      .spyOn(authService, "usePsnAuthorization")
      .mockResolvedValue(mockPsnAuthorization);

    const getUserTitlesSpy = jest
      .spyOn(PsnApiModule, "getUserTitles")
      .mockResolvedValueOnce({
        totalItemCount: 0,
        trophyTitles: []
      });

    // ACT
    await psnDataService.fetchTitleHistoryByAccountId("mockAccountId", 800);

    // ASSERT
    expect(getUserTitlesSpy).toHaveBeenCalledWith(
      mockPsnAuthorization,
      "mockAccountId",
      { offset: 800, limit: 800 }
    );
  });

  describe("Find account ID for PSN user name", () => {
    it("given a PSN user name, can fetch its associated account ID", async () => {
      // ARRANGE
      const psnDataService = app.get(PsnDataService);

      const mockPsnAuthorization = {
        accessToken: "mockAccessToken",
        refreshToken: "mockRefreshToken",
        accessTokenExpiresOn: dayjs().add(1, "year").toISOString(),
        refreshTokenExpiresOn: dayjs().add(1, "year").toISOString()
      };

      jest
        .spyOn(authService, "usePsnAuthorization")
        .mockResolvedValue(mockPsnAuthorization);

      jest.spyOn(PsnApiModule, "makeUniversalSearch").mockResolvedValueOnce({
        domainResponses: [
          {
            results: [
              {
                socialMetadata: {
                  onlineId: "mockUserName",
                  accountId: "foundAccountId"
                }
              }
            ]
          }
        ]
      });

      // ACT
      const foundAccountId = await psnDataService.fetchAccountIdFromUserName(
        "mockUserName"
      );

      // ASSERT
      expect(foundAccountId).toEqual("foundAccountId");
    });

    it("given a PSN user name, if an account ID cannot be found then null is returned", async () => {
      // ARRANGE
      const psnDataService = app.get(PsnDataService);

      const mockPsnAuthorization = {
        accessToken: "mockAccessToken",
        refreshToken: "mockRefreshToken",
        accessTokenExpiresOn: dayjs().add(1, "year").toISOString(),
        refreshTokenExpiresOn: dayjs().add(1, "year").toISOString()
      };

      jest
        .spyOn(authService, "usePsnAuthorization")
        .mockResolvedValue(mockPsnAuthorization);

      jest.spyOn(PsnApiModule, "makeUniversalSearch").mockResolvedValueOnce({
        domainResponses: [
          {
            results: [
              {
                socialMetadata: {
                  onlineId: "mockUserName",
                  accountId: "foundAccountId"
                }
              }
            ]
          }
        ]
      });

      // ACT
      const foundAccountId = await psnDataService.fetchAccountIdFromUserName(
        "unknownUserName" // this is not in the mock response
      );

      // ASSERT
      expect(foundAccountId).toBeNull();
    });

    it("given a PSN user name, if the account ID is not initially found, retries just in case", async () => {
      // ARRANGE
      // Sometimes, for reasons unknown, PSN will decide to just not return accurate
      // search results on the 1st call. We try a maximum of 3 times.

      const psnDataService = app.get(PsnDataService);

      const mockPsnAuthorization = {
        accessToken: "mockAccessToken",
        refreshToken: "mockRefreshToken",
        accessTokenExpiresOn: dayjs().add(1, "year").toISOString(),
        refreshTokenExpiresOn: dayjs().add(1, "year").toISOString()
      };

      jest
        .spyOn(authService, "usePsnAuthorization")
        .mockResolvedValue(mockPsnAuthorization);

      jest
        .spyOn(PsnApiModule, "makeUniversalSearch")
        // Nothing on this 1st call.
        .mockResolvedValueOnce({
          domainResponses: [
            {
              results: []
            }
          ]
        })
        // This is the 2nd call.
        .mockResolvedValue({
          domainResponses: [
            {
              results: [
                {
                  socialMetadata: {
                    onlineId: "mockUserName",
                    accountId: "foundAccountId"
                  }
                }
              ]
            }
          ]
        });

      // ACT
      const foundAccountId = await psnDataService.fetchAccountIdFromUserName(
        "mockUserName" // this is not in the mock response
      );

      // ASSERT
      expect(foundAccountId).toEqual("foundAccountId");
    });
  });
});
