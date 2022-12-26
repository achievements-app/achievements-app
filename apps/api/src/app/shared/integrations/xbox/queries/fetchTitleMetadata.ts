import {
  type XBLAuthorization,
  call as xblCall
} from "@xboxreplay/xboxlive-api";
import urlcat from "urlcat";

import type { FetchXboxTitleMetadataResponse } from "../models";

export async function fetchTitleMetadata(
  payload: { xuid: string; titleId: string },
  authorization: XBLAuthorization
): Promise<FetchXboxTitleMetadataResponse> {
  const apiBaseUrl = "https://titlehub.xboxlive.com";
  const requestUrl = urlcat(
    apiBaseUrl,
    "/users/xuid(:xuid)/titles/titleid(:titleId)/decoration/Achievement,Image",
    { xuid: payload.xuid, titleId: payload.titleId }
  );

  return await xblCall<FetchXboxTitleMetadataResponse>(
    { url: requestUrl },
    authorization
  );
}
