import { Injectable } from "@nestjs/common";

import type { RetroachievementsClientInstance } from "./models";
import { initializeRetroAchievementsClientPool } from "./utils/initializeRetroAchievementsClientPool";

@Injectable()
export class RetroachievementsDataService {
  #clientPool = initializeRetroAchievementsClientPool();

  async fetchRecentUserGames(targetUserName: string) {
    const clientInstance = this.#pickRandomClientFromPool(this.#clientPool);

    await clientInstance.limiter.removeTokens(1);

    return await clientInstance.client.getUserRecentlyPlayedGames(
      targetUserName,
      50
    );
  }

  async fetchAllUserGames(targetUserName: string) {
    const clientInstance = this.#pickRandomClientFromPool(this.#clientPool);

    await clientInstance.limiter.removeTokens(1);

    return await clientInstance.client.getUserGameCompletionStats(
      targetUserName
    );
  }

  async fetchUserGameProgress(
    targetUserName: string,
    serviceTitleId: number | string
  ) {
    const clientInstance = this.#pickRandomClientFromPool(this.#clientPool);

    await clientInstance.limiter.removeTokens(1);

    return clientInstance.client.getUserProgressForGameId(
      targetUserName,
      Number(serviceTitleId)
    );
  }

  async fetchDeepGameInfo(serviceTitleId: number | string) {
    const clientInstance = this.#pickRandomClientFromPool(this.#clientPool);

    await clientInstance.limiter.removeTokens(1);

    return clientInstance.client.getExtendedGameInfoByGameId(
      Number(serviceTitleId)
    );
  }

  // We use a very naive load balancing strategy here.
  // Just pick a random client from the pool, regardless of
  // how loaded they currently are. For now, we can deal with
  // sometimes randomly picking the most-burdened client.
  #pickRandomClientFromPool(clientPool: RetroachievementsClientInstance[]) {
    return clientPool[Math.floor(Math.random() * clientPool.length)];
  }
}
