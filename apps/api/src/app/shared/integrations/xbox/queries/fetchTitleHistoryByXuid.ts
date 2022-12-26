import {
  type XBLAuthorization,
  call as xblCall
} from "@xboxreplay/xboxlive-api";
import urlcat from "urlcat";

import type {
  FetchXboxTitleHistoryResponse,
  XboxLegacyTitleHistoryEntity,
  XboxModernTitleHistoryEntity
} from "../models";

// Based on the variant, the return type will change.
// This is achieved via return type overloads, hence
// why we have some crazy-looking exports in this file.

export async function fetchTitleHistoryByXuid(
  payload: { xuid: string },
  authorization: XBLAuthorization,
  variant: "legacy"
): Promise<FetchXboxTitleHistoryResponse<XboxLegacyTitleHistoryEntity>>;

export async function fetchTitleHistoryByXuid(
  payload: { xuid: string },
  authorization: XBLAuthorization,
  variant: "modern"
): Promise<FetchXboxTitleHistoryResponse<XboxModernTitleHistoryEntity>>;

// --- Implementation begins below this line. ---

export async function fetchTitleHistoryByXuid(
  payload: { xuid: string },
  authorization: XBLAuthorization,
  variant: "modern" | "legacy"
): Promise<
  FetchXboxTitleHistoryResponse<
    XboxLegacyTitleHistoryEntity | XboxModernTitleHistoryEntity
  >
> {
  const apiBaseUrl = "https://achievements.xboxlive.com";
  const requestUrl = urlcat(apiBaseUrl, "/users/xuid(:xuid)/history/titles", {
    xuid: payload.xuid,
    maxItems: 9000
  });

  const schemaVersion = variant === "modern" ? 2 : 1;

  return await xblCall({ url: requestUrl }, authorization, schemaVersion);
}
