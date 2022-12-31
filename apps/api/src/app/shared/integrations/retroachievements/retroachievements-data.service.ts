import { Injectable } from "@nestjs/common";

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
