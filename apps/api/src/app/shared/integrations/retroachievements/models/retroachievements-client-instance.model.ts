import type { RateLimiter } from "limiter";
import type { RetroAchievementsClient } from "retroachievements-js";

export interface RetroachievementsClientInstance {
  client: RetroAchievementsClient;
  limiter: RateLimiter;
}
