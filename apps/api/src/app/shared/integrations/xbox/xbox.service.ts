import { Injectable } from "@nestjs/common";

import type {
  MappedCompleteGame,
  MappedGame
} from "@achievements-app/data-access-common-models";

import { mapTitleHistoryEntityToStoredGame } from "./utils/mapTitleHistoryEntityToStoredGame";
import { mapXboxDeepGameInfoToCompleteGame } from "./utils/mapXboxDeepGameInfoToCompleteGame";
import { XboxDataService } from "./xbox-data.service";

@Injectable()
export class XboxService {
  constructor(private readonly dataService: XboxDataService) {}

  async fetchCompleteGameMetadata(
    userXuid: string,
    serviceTitleId: string,
    schemaKind: "legacy" | "modern"
  ): Promise<MappedCompleteGame> {
    const xboxDeepGameInfo = await this.dataService.fetchDeepGameInfo(
      userXuid,
      serviceTitleId,
      schemaKind
    );

    return mapXboxDeepGameInfoToCompleteGame(xboxDeepGameInfo, schemaKind);
  }

  async fetchUserPlayedGames(userXuid: string): Promise<MappedGame[]> {
    const allUserPlayedGames =
      await this.dataService.fetchCompleteTitleHistoryByXuid(userXuid);

    return allUserPlayedGames
      .map(mapTitleHistoryEntityToStoredGame)
      .filter((game) => game.knownUserEarnedPointsCount > 0);
  }
}
