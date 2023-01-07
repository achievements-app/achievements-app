import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as XboxLiveApiModule from "@xboxreplay/xboxlive-api";
import * as XboxLiveAuthModule from "@xboxreplay/xboxlive-auth";

import { DbService } from "@/api/shared/db/db.service";

import * as FetchTitleAchievementsModule from "./queries/fetchTitleAchievements";
import * as FetchTitleHistoryByXuidModule from "./queries/fetchTitleHistoryByXuid";
import * as FetchTitleMetadataModule from "./queries/fetchTitleMetadata";
import { buildLegacyAchievementImageUrl } from "./utils/buildLegacyAchievementImageUrl";
import * as xboxApiMocks from "./utils/xboxApiMocks";
import { XboxModule } from "./xbox.module";
import { XboxDataService } from "./xbox-data.service";

describe("Service: XboxDataService", () => {
  let app: INestApplication;

  jest.spyOn(XboxLiveAuthModule, "authenticate").mockResolvedValue({
    xuid: "authXuid",
    user_hash: "authUserHash",
    xsts_token: "authXstsToken",
    display_claims: {},
    expires_on: "mockExpiresOn"
  });

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [XboxModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
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
    jest.spyOn(XboxLiveAuthModule, "authenticate").mockResolvedValueOnce({
      xuid: "authXuid",
      user_hash: "authUserHash",
      xsts_token: "authXstsToken",
      display_claims: {},
      expires_on: "mockExpiresOn"
    });

    const xboxDataService = app.get(XboxDataService);

    // ASSERT
    expect(xboxDataService).toBeTruthy();
  });

  it("given a gamertag, can make a call to Xbox to retrieve a XUID", async () => {
    // ARRANGE
    const mockGamertag = "mockGamertag";

    const xboxDataService = app.get(XboxDataService);

    jest.spyOn(XboxLiveAuthModule, "authenticate").mockResolvedValueOnce({
      xuid: "authXuid",
      user_hash: "authUserHash",
      xsts_token: "authXstsToken",
      display_claims: {},
      expires_on: "mockExpiresOn"
    });

    const getPlayerXUIDSpy = jest
      .spyOn(XboxLiveApiModule, "getPlayerXUID")
      .mockResolvedValue("someXuid");

    // ACT
    const xuid = await xboxDataService.fetchXuidFromGamertag(mockGamertag);

    // ASSERT
    expect(getPlayerXUIDSpy).toHaveBeenCalledWith(mockGamertag, {
      userHash: "authUserHash",
      XSTSToken: "authXstsToken",
      xuid: "authXuid"
    });

    expect(xuid).toEqual("someXuid");
  });

  it("given a XUID and title ID, can fetch the entire set of a metadata for a legacy title", async () => {
    // ARRANGE
    jest.spyOn(XboxLiveAuthModule, "authenticate").mockResolvedValueOnce({
      xuid: "authXuid",
      user_hash: "authUserHash",
      xsts_token: "authXstsToken",
      display_claims: {},
      expires_on: "mockExpiresOn"
    });

    const titleMetadata = xboxApiMocks.generateXboxTitleMetadata();
    const titleLegacyAchievements = [
      xboxApiMocks.generateXboxLegacyAchievementEntity({
        unlocked: false,
        unlockedOnline: false
      }),
      xboxApiMocks.generateXboxLegacyAchievementEntity({
        unlocked: true,
        unlockedOnline: true
      })
    ];

    jest
      .spyOn(FetchTitleMetadataModule, "fetchTitleMetadata")
      .mockResolvedValueOnce({
        xuid: "mockXuid",
        titles: [titleMetadata]
      });

    jest
      .spyOn(FetchTitleAchievementsModule, "fetchTitleAchievements")
      .mockResolvedValueOnce({
        achievements: titleLegacyAchievements as any,
        pagingInfo: { totalRecords: 2, continuationToken: null }
      });

    const xboxDataService = app.get(XboxDataService);

    // ACT
    const deepGameInfo = await xboxDataService.fetchDeepGameInfo(
      "12345",
      "12345",
      "legacy"
    );

    // ASSERT
    expect(deepGameInfo.achievementsSchemaKind).toEqual("legacy");
    expect(deepGameInfo.titleId).toEqual(titleMetadata.titleId);
    expect(deepGameInfo.achievements.length).toEqual(2);

    const foundEarnedAchievement = deepGameInfo.achievements.find(
      (achievement) => achievement.timeUnlocked
    );

    expect(foundEarnedAchievement).toBeTruthy();
    expect(foundEarnedAchievement.gamerscore).toEqual(
      Number(titleLegacyAchievements[1].gamerscore)
    );

    expect(foundEarnedAchievement.imageUrl).toEqual(
      buildLegacyAchievementImageUrl(
        titleLegacyAchievements[1].titleId,
        titleLegacyAchievements[1].imageId
      )
    );
  });

  it("given a XUID and title ID, can fetch the entire set of metadata for a modern title", async () => {
    // ARRANGE
    jest.spyOn(XboxLiveAuthModule, "authenticate").mockResolvedValueOnce({
      xuid: "authXuid",
      user_hash: "authUserHash",
      xsts_token: "authXstsToken",
      display_claims: {},
      expires_on: "mockExpiresOn"
    });

    const titleMetadata = xboxApiMocks.generateXboxTitleMetadata();
    const titleModernAchievements = [
      xboxApiMocks.generateXboxModernAchievementEntity({
        progressState: "NotStarted"
      }),
      xboxApiMocks.generateXboxModernAchievementEntity({
        progressState: "Achieved"
      })
    ];

    jest
      .spyOn(FetchTitleMetadataModule, "fetchTitleMetadata")
      .mockResolvedValueOnce({
        xuid: "mockXuid",
        titles: [titleMetadata]
      });

    jest
      .spyOn(FetchTitleAchievementsModule, "fetchTitleAchievements")
      .mockResolvedValueOnce({
        achievements: titleModernAchievements,
        pagingInfo: { totalRecords: 2, continuationToken: null }
      });

    const xboxDataService = app.get(XboxDataService);

    // ACT
    const deepGameInfo = await xboxDataService.fetchDeepGameInfo(
      "12345",
      "12345",
      "modern"
    );

    // ASSERT
    expect(deepGameInfo.achievementsSchemaKind).toEqual("modern");
    expect(deepGameInfo.titleId).toEqual(titleMetadata.titleId);
    expect(deepGameInfo.achievements.length).toEqual(2);

    const foundEarnedAchievement = deepGameInfo.achievements.find(
      (achievement) => achievement.timeUnlocked
    );

    expect(foundEarnedAchievement).toBeTruthy();
    expect(foundEarnedAchievement.gamerscore).toEqual(
      Number(titleModernAchievements[1].rewards[0].value)
    );

    expect(foundEarnedAchievement.imageUrl).toEqual(
      titleModernAchievements[1].mediaAssets[0].url
    );
  });

  it("given a user XUID, can fetch a complete title history for that user", async () => {
    // ARRANGE
    jest.spyOn(XboxLiveAuthModule, "authenticate").mockResolvedValueOnce({
      xuid: "authXuid",
      user_hash: "authUserHash",
      xsts_token: "authXstsToken",
      display_claims: {},
      expires_on: "mockExpiresOn"
    });

    const mockModernTitleHistory = [
      xboxApiMocks.generateXboxModernTitleHistoryEntity(),
      xboxApiMocks.generateXboxModernTitleHistoryEntity()
    ];
    const mockLegacyTitleHistory = [
      xboxApiMocks.generateXboxLegacyTitleHistoryEntity(),
      xboxApiMocks.generateXboxLegacyTitleHistoryEntity()
    ];

    jest
      .spyOn(FetchTitleHistoryByXuidModule, "fetchTitleHistoryByXuid")
      // This will be called twice.
      .mockImplementation(
        (
          payload: any,
          authorization: any,
          variant: "modern" | "legacy"
        ): any => {
          if (variant === "modern") {
            return {
              titles: mockModernTitleHistory,
              pagingInfo: {
                continuationToken: null,
                totalRecords: mockModernTitleHistory.length
              }
            };
          }

          return {
            titles: mockLegacyTitleHistory,
            pagingInfo: {
              continuationToken: null,
              totalRecords: mockModernTitleHistory.length
            }
          };
        }
      );

    const xboxDataService = app.get(XboxDataService);

    // ACT
    const completeTitleHistory =
      await xboxDataService.fetchCompleteTitleHistoryByXuid("12345");

    // ASSERT
    expect(completeTitleHistory.length).toEqual(4);

    const foundModernTitle = completeTitleHistory.find(
      (history) => history.name === mockModernTitleHistory[0].name
    );

    expect(foundModernTitle).toBeTruthy();
    expect(foundModernTitle.titleId).toEqual(mockModernTitleHistory[0].titleId);
    expect(foundModernTitle.titleKind).toEqual("modern");
    expect(foundModernTitle.totalPossibleGamerscore).toEqual(
      mockModernTitleHistory[0].maxGamerscore
    );
    expect(foundModernTitle.totalUnlockedGamerscore).toEqual(
      mockModernTitleHistory[0].currentGamerscore
    );

    const foundLegacyTitle = completeTitleHistory.find(
      (history) => history.name === mockLegacyTitleHistory[0].name
    );

    expect(foundLegacyTitle).toBeTruthy();
    expect(foundLegacyTitle.titleId).toEqual(mockLegacyTitleHistory[0].titleId);
    expect(foundLegacyTitle.titleKind).toEqual("legacy");
    expect(foundLegacyTitle.totalPossibleGamerscore).toEqual(
      mockLegacyTitleHistory[0].totalGamerscore
    );
    expect(foundLegacyTitle.totalUnlockedGamerscore).toEqual(
      mockLegacyTitleHistory[0].currentGamerscore
    );
  });
});
