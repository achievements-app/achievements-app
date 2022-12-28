import { Injectable } from "@nestjs/common";
import { RateLimiter } from "limiter";

import client from "./utils/retroachievements-client";

@Injectable()
export class RetroachievementsDataService {
  // SEE: https://github.dev/RetroAchievements/RAWeb/blob/ae5bf5e49246c0f50582177bdab9dd0e88f0a7d1/app/Api/RouteServiceProvider.php#L24-L25
  #rateLimiter = new RateLimiter({
    tokensPerInterval: 2,
    interval: "second"
  });

  // SEE: https://github.dev/RetroAchievements/RAWeb/blob/master/public/API/API_GetUserCompletedGames.php
  async fetchAllUserGames(targetUserName: string) {
    const userCompletedGames = await client.getUserGameCompletionStats(
      targetUserName
    );

    // RetroAchievements returns each game potentially twice. This is because
    // softcore and hardcore mode are treated as separate games in their DB.
    // We'll filter out the softcore entries.
    return userCompletedGames.filter((game) => game.hardcoreMode === 1);
  }

  async fetchUserGameProgress(
    targetUserName: string,
    serviceTitleId: number | string
  ) {
    await this.#rateLimiter.removeTokens(1);

    return client.getUserProgressForGameId(
      targetUserName,
      Number(serviceTitleId)
    );
  }

  async fetchDeepGameInfo(serviceTitleId: number | string) {
    await this.#rateLimiter.removeTokens(1);

    return client.getExtendedGameInfoByGameId(Number(serviceTitleId));
  }
}
