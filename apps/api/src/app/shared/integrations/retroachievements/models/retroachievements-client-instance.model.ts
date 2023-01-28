import type { AuthObject } from "@retroachievements/api";
import type { RateLimiter } from "limiter";
import type { RetroAchievementsClient } from "retroachievements-js";

export interface RetroachievementsClientInstance {
  authObject: AuthObject;

  /** @deprecated */
  client: RetroAchievementsClient;

  limiter: RateLimiter;
}
