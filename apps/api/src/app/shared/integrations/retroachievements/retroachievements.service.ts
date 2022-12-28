import { Injectable } from "@nestjs/common";

import type {
  MappedCompleteGame,
  MappedGame,
  MappedGameAchievement
} from "@/api/common/models";

import { RetroachievementsDataService } from "./retroachievements-data.service";
import { mapAchievementToMappedGameAchievement } from "./utils/mapAchievementToMappedGameAchievement";
import { mapGameInfoExtendedToCompleteGame } from "./utils/mapGameInfoExtendedToCompleteGame";
import { mapUserGameCompletionToStoredGame } from "./utils/mapUserGameCompletionToStoredGame";

@Injectable()
export class RetroachievementsService {
  constructor(private readonly dataService: RetroachievementsDataService) {}

  async fetchCompleteGameMetadata(
    serviceTitleId: number | string
  ): Promise<MappedCompleteGame> {
    const gameInfoExtended = await this.dataService.fetchDeepGameInfo(
      serviceTitleId
    );

    return mapGameInfoExtendedToCompleteGame(gameInfoExtended);
  }

  async fetchUserPlayedGames(targetUserName: string): Promise<MappedGame[]> {
    const allUserPlayedGames = await this.dataService.fetchAllUserGames(
      targetUserName
    );

    return allUserPlayedGames.map(mapUserGameCompletionToStoredGame);
  }

  async fetchUserGameUnlockedAchievements(
    targetUserName: string,
    serviceTitleId: number | string
  ): Promise<MappedGameAchievement[]> {
    const gameInfoAndUserProgress =
      await this.dataService.fetchUserGameProgress(
        targetUserName,
        serviceTitleId
      );

    const earnedGameAchievements = gameInfoAndUserProgress.achievements.filter(
      (achievement) => !!achievement.dateEarnedHardcore
    );

    return earnedGameAchievements.map(mapAchievementToMappedGameAchievement);
  }
}
