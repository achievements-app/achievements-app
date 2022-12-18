import { Injectable } from "@nestjs/common";

import client from "./utils/retroachievements-client";

@Injectable()
export class RetroachievementsDataService {
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
    return client.getUserProgressForGameId(
      targetUserName,
      Number(serviceTitleId)
    );
  }

  async fetchDeepGameInfo(serviceTitleId: number | string) {
    return client.getExtendedGameInfoByGameId(Number(serviceTitleId));
  }
}
