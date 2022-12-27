import { type XBLAuthorization } from "@xboxreplay/xboxlive-api";
import urlcat from "urlcat";

import type {
  FetchXboxTitleAchievementsResponse,
  XboxLegacyAchievementEntity,
  XboxModernAchievementEntity
} from "../models";
import { limitedXboxCall } from "../utils/limitedXboxCall";

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
  const requestUrl = urlcat(apiBaseUrl, "/users/xuid(:xuid)/achievements", {
    xuid: payload.xuid,
    titleId: payload.titleId,
    maxItems: 1000
  });

  const schemaVersion = variant === "modern" ? 4 : 3;

  return await limitedXboxCall(
    { url: requestUrl },
    authorization,
    schemaVersion
  );
}
