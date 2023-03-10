/* eslint-disable security/detect-object-injection */

import { buildAuthorization } from "@retroachievements/api";
import { RateLimiter } from "limiter";

import type { RetroachievementsClientInstance } from "../models";

const buildClientInstance = (
  credentialsIndex: number
): RetroachievementsClientInstance => {
  let userNameEnvKey = "RA_USERNAME";
  let apiKeyEnvKey = "RA_API_KEY";

  // "RA_USERNAME2" , "RA_API_KEY2"
  userNameEnvKey += credentialsIndex;
  apiKeyEnvKey += credentialsIndex;

  return {
    authObject: buildAuthorization({
      userName: process.env[userNameEnvKey],
      webApiKey: process.env[apiKeyEnvKey]
    }),
    limiter: new RateLimiter({ tokensPerInterval: 1, interval: "second" })
  };
};

export const initializeRetroAchievementsClientPool =
  (): RetroachievementsClientInstance[] => {
    const clientPool: RetroachievementsClientInstance[] = [];

    if (process.env.RA_USERNAME1 && process.env.RA_API_KEY1) {
      clientPool.push(buildClientInstance(1));
    }

    if (process.env.RA_USERNAME2 && process.env.RA_API_KEY2) {
      clientPool.push(buildClientInstance(2));
    }

    if (process.env.RA_USERNAME3 && process.env.RA_API_KEY3) {
      clientPool.push(buildClientInstance(3));
    }

    if (clientPool.length === 0) {
      throw new Error("RA_USERNAME and RA_API_KEY env vars are not present.");
    }

    return clientPool;
  };
