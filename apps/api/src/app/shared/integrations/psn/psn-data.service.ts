import { Injectable } from "@nestjs/common";
import * as psn from "psn-api";

import { Logger } from "@/api/shared/logger/logger.service";

import { PsnAuthService } from "./psn-auth.service";

@Injectable()
export class PsnDataService {
  #logger = new Logger(PsnDataService.name);

  constructor(private readonly authService: PsnAuthService) {}

  async fetchAllTitleTrophies(
    psnTitleId: string,
    psnTitleSchema: "trophy" | "trophy2"
  ) {
    const authorization = await this.authService.usePsnAuthorization();

    return await psn.getTitleTrophies(authorization, psnTitleId, "all", {
      npServiceName: psnTitleSchema
    });
  }

  async fetchUserEarnedTrophiesForTitle(
    accountId: string,
    serviceTitleId: string,
    psnServiceName: "trophy" | "trophy2"
  ) {
    const authorization = await this.authService.usePsnAuthorization();

    return await psn.getUserTrophiesEarnedForTitle(
      authorization,
      accountId,
      serviceTitleId,
      "all",
      {
        npServiceName: psnServiceName
      }
    );
  }

  async fetchTitleHistoryByAccountId(accountId: string, offset?: number) {
    this.#logger.log(`Fetching title history for PSN:${accountId}`);

    const authorization = await this.authService.usePsnAuthorization();
    return await psn.getUserTitles(authorization, accountId, {
      offset,
      limit: 800 // This is the max allowed by PSN.
    });
  }

  async fetchAccountIdFromUserName(userName: string) {
    this.#logger.log(`Fetching Account ID for PSN user ${userName}`);

    const authorization = await this.authService.usePsnAuthorization();

    let attemptsRemaining = 3;
    let foundAccountId: string | null = null;

    while (!foundAccountId && attemptsRemaining > 0) {
      this.#logger.log(
        `Trying to fetch account ID for ${userName}, attempts remaining: ${attemptsRemaining}`
      );

      const allAccountsSearchResults = await psn.makeUniversalSearch(
        authorization,
        userName,
        "SocialAllAccounts"
      );

      try {
        const allResults = allAccountsSearchResults.domainResponses[0].results;

        const foundCorrectResult = allResults.find(
          (result) => result.socialMetadata.onlineId === userName
        );

        if (foundCorrectResult) {
          foundAccountId = foundCorrectResult.socialMetadata.accountId;

          this.#logger.log(
            `Found Account ID ${foundAccountId} for PSN user ${userName}`
          );
        } else {
          this.#logger.warn(
            `Unable to find Account ID for PSN user ${userName}, ${allResults}`
          );
          attemptsRemaining -= 1;
        }
      } catch (error) {
        this.#logger.warn(`Unable to find Account ID for PSN user ${userName}`);
        attemptsRemaining -= 1;
      }
    }

    return foundAccountId;
  }
}
