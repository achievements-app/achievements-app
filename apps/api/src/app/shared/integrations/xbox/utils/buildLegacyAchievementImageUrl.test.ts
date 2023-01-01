import { buildLegacyAchievementImageUrl } from "./buildLegacyAchievementImageUrl";

describe("Util: buildLegacyAchievementImageUrl", () => {
  it("is defined #sanity", () => {
    // ASSERT
    expect(buildLegacyAchievementImageUrl).toBeDefined();
  });

  it("given an achievement title ID and image ID, constructs a working image URL", () => {
    // ARRANGE
    const mockTitleId = 1234512345;
    const mockImageId = 5432154321;

    // ACT
    const achievementImageUrl = buildLegacyAchievementImageUrl(
      mockTitleId,
      mockImageId
    );

    // ASSERT
    expect(achievementImageUrl).toEqual(
      "http://image.xboxlive.com/global/t.499529D9/ach/0/143C818D1"
    );
  });
});
