import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import type { AuthTokensResponse as PsnAuthTokensResponse } from "psn-api";

import type { PsnAuthorization } from "../models";

dayjs.extend(utc);

export const mapAuthTokensResponseToPsnAuthorization = (
  authTokensResponse: PsnAuthTokensResponse
): PsnAuthorization => {
  const accessToken = authTokensResponse.accessToken;
  const refreshToken = authTokensResponse.refreshToken;

  const accessTokenExpiresOn = dayjs()
    .utc()
    .add(authTokensResponse.expiresIn, "seconds")
    .toISOString();

  const refreshTokenExpiresOn = dayjs()
    .utc()
    .add(authTokensResponse.refreshTokenExpiresIn, "seconds")
    .toISOString();

  return {
    accessToken,
    accessTokenExpiresOn,
    refreshToken,
    refreshTokenExpiresOn
  };
};
