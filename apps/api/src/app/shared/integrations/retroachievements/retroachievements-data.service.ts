import { Injectable } from "@nestjs/common";
import * as raApi from "@retroachievements/api";

import type { RetroachievementsClientInstance } from "./models";
import { initializeRetroAchievementsClientPool } from "./utils/initializeRetroAchievementsClientPool";

@Injectable()
export class RetroachievementsDataService {
  #clientPool = initializeRetroAchievementsClientPool();

  async fetchAllUserGames(targetUserName: string) {
    const clientInstance = this.#pickRandomClientFromPool(this.#clientPool);

    await clientInstance.limiter.removeTokens(1);

    const userCompletedGames =
      await clientInstance.client.getUserGameCompletionStats(targetUserName);

    // RetroAchievements returns each game potentially twice. This is because
    // softcore and hardcore mode are treated as separate games in their DB.
    // We'll filter out the softcore entries.
    return userCompletedGames.filter((game) => game.hardcoreMode === 1);
  }

  async fetchDeepGameInfo(serviceTitleId: number | string) {
    const clientInstance = this.#pickRandomClientFromPool(this.#clientPool);

    await clientInstance.limiter.removeTokens(1);

    return raApi.getGameExtended(clientInstance.authObject, {
      gameId: Number(serviceTitleId)
    });
  }

  async fetchRecentUserGames(targetUserName: string) {
    const clientInstance = this.#pickRandomClientFromPool(this.#clientPool);

    await clientInstance.limiter.removeTokens(1);

    return await raApi.getUserRecentlyPlayedGames(clientInstance.authObject, {
      userName: targetUserName,
      count: 50
    });
  }

  async fetchUserGameProgress(
    targetUserName: string,
    serviceTitleId: number | string
  ) {
    const clientInstance = this.#pickRandomClientFromPool(this.#clientPool);

    await clientInstance.limiter.removeTokens(1);

    return raApi.getGameInfoAndUserProgress(clientInstance.authObject, {
      userName: targetUserName,
      gameId: Number(serviceTitleId)
    });
  }

  async fetchUserPoints(targetUserName: string) {
    const clientInstance = this.#pickRandomClientFromPool(this.#clientPool);

    await clientInstance.limiter.removeTokens(1);

    return raApi.getUserPoints(clientInstance.authObject, {
      userName: targetUserName
    });
  }

  // We use a very naive load balancing strategy here.
  // Just pick a random client from the pool, regardless of
  // how loaded they currently are. For now, we can deal with
  // sometimes randomly picking the most-burdened client.
  #pickRandomClientFromPool(clientPool: RetroachievementsClientInstance[]) {
    return clientPool[Math.floor(Math.random() * clientPool.length)];
  }
}
