import type { XboxSanitizedTitleHistoryEntity } from "../models";
import { mapTitleHistoryEntityToStoredGame } from "./mapTitleHistoryEntityToStoredGame";

describe("Util: mapTitleHistoryEntityToStoredGame", () => {
  it("is defined #sanity", () => {
    // ASSERT
    expect(mapTitleHistoryEntityToStoredGame).toBeDefined();
  });

  it("given a XboxSanitizedTitleHistoryEntity, maps it to a MappedGame entity", () => {
    // ARRANGE
    const mockXboxSanitizedTitleHistoryEntity: XboxSanitizedTitleHistoryEntity =
      {
        name: "mockName",
        titleId: 12345,
        titleKind: "modern",
        totalPossibleGamerscore: 1000,
        totalUnlockedGamerscore: 500
      };

    // ACT
    const mappedGame = mapTitleHistoryEntityToStoredGame(
      mockXboxSanitizedTitleHistoryEntity
    );

    // ASSERT
    expect(mappedGame.name).toEqual("mockName");
    expect(mappedGame.gamingService).toEqual("XBOX");
    expect(mappedGame.serviceTitleId).toEqual("12345");
    expect(mappedGame.xboxAchievementsSchemaKind).toEqual("modern");
    expect(mappedGame.knownUserEarnedPointsCount).toEqual(500);
  });
});
