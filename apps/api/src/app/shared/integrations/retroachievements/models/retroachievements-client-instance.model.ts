import type { AuthObject } from "@retroachievements/api";
import type { RateLimiter } from "limiter";

export interface RetroachievementsClientInstance {
  authObject: AuthObject;

  limiter: RateLimiter;
}
