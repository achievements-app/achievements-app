import {
  type XBLAuthorization,
  call as xblCall
} from "@xboxreplay/xboxlive-api";
import urlcat from "urlcat";

import type {
  XboxLegacyTitleHistoryEntity,
  XboxModernTitleHistoryEntity,
  XboxTitleHistoryResponse
} from "../models";

// Based on the variant, the return type will change.
// This is achieved via return type overloads, hence
// why we have some crazy-looking exports in this file.

export async function fetchTitleHistoryByXuid(
  xuid: string,
  authorization: XBLAuthorization,
  variant: "legacy"
): Promise<XboxTitleHistoryResponse<XboxLegacyTitleHistoryEntity>>;

export async function fetchTitleHistoryByXuid(
  xuid: string,
  authorization: XBLAuthorization,
  variant: "modern"
): Promise<XboxTitleHistoryResponse<XboxModernTitleHistoryEntity>>;

export async function fetchTitleHistoryByXuid(
  xuid: string,
  authorization: XBLAuthorization,
  variant: "modern" | "legacy"
): Promise<
  XboxTitleHistoryResponse<
    XboxLegacyTitleHistoryEntity | XboxModernTitleHistoryEntity
  >
> {
  const apiBaseUrl = "https://achievements.xboxlive.com";
  const requestUrl = urlcat(apiBaseUrl, "/users/xuid(:xuid)/history/titles", {
    xuid,
    maxItems: 9000
  });

  return await xblCall(
    { url: requestUrl },
    authorization,
    variant === "legacy" ? 1 : 2
  );
}
