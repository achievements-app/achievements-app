import { Injectable, OnModuleInit } from "@nestjs/common";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import * as psn from "psn-api";
import { createClient as createRedisClient } from "redis";

import { Logger } from "@/api/shared/logger/logger.service";

import type { PsnAuthorization } from "./models";
import { mapAuthTokensResponseToPsnAuthorization } from "./utils/mapAuthTokensResponseToPsnAuthorization";

dayjs.extend(utc);

@Injectable()
export class PsnAuthService implements OnModuleInit {
  #logger = new Logger(PsnAuthService.name);
  #redisClient = createRedisClient({ url: process.env["REDIS_URL"] });

  async onModuleInit() {
    this.#redisClient.on("error", (error) => {
      this.#logger.error("Redis client error", error);
    });

    // At the time of writing, there are tons of issues with NestJS
    // CacheModule and its various dependencies, making it more of a
    // headache than it's worth to use.
    await this.#redisClient.connect();

    // This will save authorization to cache if we don't have one yet.
    await this.usePsnAuthorization();
  }

  async usePsnAuthorization() {
    // PSN authorization uses access tokens and refresh tokens.
    // An access token is required on every call. It expires daily
    // and can be regenerated using a refresh token.

    let activeAuthorization = await this.#getCachedAuthorization();

    const mustReauthorizeWithPsn =
      !activeAuthorization ||
      this.#getIsExpired(activeAuthorization.refreshToken);

    if (mustReauthorizeWithPsn) {
      activeAuthorization = await this.#getNewPsnAuthorization();
    } else if (this.#getIsExpired(activeAuthorization.accessToken)) {
      this.#logger.log("Current PSN access token is expired.");

      activeAuthorization = await this.#refreshExistingPsnAuthorization(
        activeAuthorization.refreshToken
      );
    }

    return activeAuthorization;
  }

  async #getCachedAuthorization(): Promise<PsnAuthorization | null> {
    const response = await this.#redisClient.get("auth:psn");

    if (!response) {
      this.#logger.log("PSN auth cache miss");
      return null;
    }

    this.#logger.verbose("PSN auth cache hit");
    return JSON.parse(response) as PsnAuthorization;
  }

  #getIsExpired(tokenExpiresOn: string) {
    const now = dayjs().utc();
    return now.isAfter(tokenExpiresOn);
  }

  /**
   * Make a call to PSN using the account NPSSO to retrieve
   * a new authorization. This is a prerequisite to calling
   * any PSN API endpoints.
   */
  async #getNewPsnAuthorization(): Promise<PsnAuthorization> {
    this.#logger.log("Authenticating with PSN.");

    const npsso = process.env["PSN_NPSSO"];

    const accessCode = await psn.exchangeNpssoForCode(npsso);
    const newAuthorization = await psn.exchangeCodeForAccessToken(accessCode);

    const mappedAuthorization =
      mapAuthTokensResponseToPsnAuthorization(newAuthorization);

    await this.#saveAuthorizationToCache(mappedAuthorization);

    return Object.freeze(mappedAuthorization);
  }

  async #refreshExistingPsnAuthorization(
    refreshToken: string
  ): Promise<PsnAuthorization> {
    this.#logger.log("Refreshing PSN access token.");

    const newAuthorization = await psn.exchangeRefreshTokenForAuthTokens(
      refreshToken
    );

    const mappedAuthorization =
      mapAuthTokensResponseToPsnAuthorization(newAuthorization);

    await this.#saveAuthorizationToCache(mappedAuthorization);

    return Object.freeze(mappedAuthorization);
  }

  async #saveAuthorizationToCache(authorization: PsnAuthorization) {
    await this.#redisClient.set("auth:psn", JSON.stringify(authorization));
  }
}
