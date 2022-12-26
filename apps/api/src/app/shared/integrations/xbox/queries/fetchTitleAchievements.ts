import {
  type XBLAuthorization,
  call as xblCall
} from "@xboxreplay/xboxlive-api";
import urlcat from "urlcat";

import type {
  FetchXboxTitleAchievementsResponse,
  XboxLegacyAchievementEntity,
  XboxModernAchievementEntity
} from "../models";

// Based on the variant, the return type will change.
// This is achieved via return type overloads, hence
// why we have some crazy-looking exports in this file.

export async function fetchTitleAchievements(
  payload: { xuid: string; titleId: number },
  authorization: XBLAuthorization,
  variant: "legacy"
): Promise<FetchXboxTitleAchievementsResponse<XboxLegacyAchievementEntity>>;

export async function fetchTitleAchievements(
  payload: { xuid: string; titleId: number },
  authorization: XBLAuthorization,
  variant: "modern"
): Promise<FetchXboxTitleAchievementsResponse<XboxModernAchievementEntity>>;

// --- Implementation begins below this line. ---

export async function fetchTitleAchievements(
  payload: { xuid: string; titleId: number },
  authorization: XBLAuthorization,
  variant: "modern" | "legacy"
): Promise<
  FetchXboxTitleAchievementsResponse<
    XboxLegacyAchievementEntity | XboxModernAchievementEntity
  >
> {
  const apiBaseUrl = "https://achievements.xboxlive.com";
  const requestUrl = urlcat(apiBaseUrl, "/users/xuid(:xuid)/:variantRoute", {
    variantRoute: variant === "modern" ? "achievements" : "titleachievements",
    xuid: payload.xuid,
    titleId: payload.titleId,
    maxItems: 900
  });

  const schemaVersion = variant === "modern" ? 4 : 3;

  return await xblCall({ url: requestUrl }, authorization, schemaVersion);
}
