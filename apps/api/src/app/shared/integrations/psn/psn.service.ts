import { Injectable } from "@nestjs/common";
import type {
  TitleTrophiesResponse,
  TrophyTitle,
  UserTrophiesEarnedForTitleResponse
} from "psn-api";

import type {
  MappedCompleteGame,
  MappedGame
} from "@achievements-app/data-access-common-models";

import { PsnDataService } from "./psn-data.service";
import { mapTrophyResponsesToMappedGameAchievements } from "./utils/mapTrophyResponsesToMappedGameAchievements";
import { mapTrophyTitleToStoredGame } from "./utils/mapTrophyTitleToStoredGame";

@Injectable()
export class PsnService {
  constructor(private readonly dataService: PsnDataService) {}

  async fetchCompleteUserGameMetadata(
    userAccountId: string,
    mappedGame: MappedGame
  ): Promise<MappedCompleteGame> {
    const parallelApiCalls = [
      this.dataService.fetchAllTitleTrophies(
        mappedGame.serviceTitleId,
        mappedGame.psnServiceName as "trophy" | "trophy2"
      ),
      this.dataService.fetchUserEarnedTrophiesForTitle(
        userAccountId,
        mappedGame.serviceTitleId,
        mappedGame.psnServiceName as "trophy" | "trophy2"
      )
    ];

    const [allTitleTrophiesResponse, userEarnedTrophiesForTitleResponse] =
      (await Promise.all(parallelApiCalls)) as [
        TitleTrophiesResponse,
        UserTrophiesEarnedForTitleResponse
      ];

    const mappedGameAchievements = mapTrophyResponsesToMappedGameAchievements(
      allTitleTrophiesResponse,
      userEarnedTrophiesForTitleResponse
    );

    return {
      ...mappedGame,
      achievements: mappedGameAchievements
    };
  }

  async fetchUserPlayedGames(userAccountId: string) {
    const accumulatedTitles: TrophyTitle[] = [];

    // If the user has more than the max allowed to be returned on a
    // single call, the API will include an "offset" pointing to where the
    // next page starts. To get all the user's games, we need to make a
    // call each time we have an offset value. When we've identified that
    // we have all the user's games, set the `currentOffset` value to
    // `null` to stop the while loop.
    let currentOffset: number | null = 0;
    while (currentOffset !== null) {
      const { trophyTitles, totalItemCount, nextOffset } =
        await this.dataService.fetchTitleHistoryByAccountId(
          userAccountId,
          currentOffset
        );

      accumulatedTitles.push(...trophyTitles);

      if (!nextOffset || accumulatedTitles.length === totalItemCount) {
        currentOffset = null;
      } else {
        currentOffset = nextOffset;
      }
    }

    return accumulatedTitles
      .filter((title) => title.hiddenFlag !== true)
      .map(mapTrophyTitleToStoredGame);
  }
}
