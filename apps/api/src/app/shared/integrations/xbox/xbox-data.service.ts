import { Injectable } from "@nestjs/common";
import { type XBLAuthorization, getPlayerXUID } from "@xboxreplay/xboxlive-api";
import {
  type CredentialsAuthenticateInitialResponse,
  authenticate as callXboxAuthenticate
} from "@xboxreplay/xboxlive-auth";
import dayjs from "dayjs";

import { Logger } from "@/api/shared/logger/logger.service";

import type {
  XboxLegacyTitleHistoryEntity,
  XboxModernTitleHistoryEntity,
  XboxSanitizedTitleHistoryEntity
} from "./models";
import { fetchTitleHistoryByXuid } from "./queries/fetchTitleHistoryByXuid";

@Injectable()
export class XboxDataService {
  #currentAuthorization: Readonly<CredentialsAuthenticateInitialResponse>;
  #logger = new Logger(XboxDataService.name);

  /**
   * Given a user's XUID, fetch their complete list of titles on
   * the Xbox network. These titles do not contain achievement lists.
   * They only contain bare minimum information about the title's name,
   * ID, and earned/possible gamerscore.
   */
  async fetchCompleteTitleHistoryByXuid(
    xuid: string
  ): Promise<XboxSanitizedTitleHistoryEntity[]> {
    const authorization = await this.#useXboxAuthorization();

    // This, unfortunately, requires two API calls. Microsoft has completely
    // separated pre-Xbox One title history to a different schema. Therefore,
    // we have to fetch both the Xbox 360 title history and post-Xbox 360 title history.
    // We'll refer to these as "legacy" and "modern".
    const [userLegacyTitleHistory, userModernTitleHistory] = await Promise.all([
      fetchTitleHistoryByXuid(xuid, authorization, "legacy"),
      fetchTitleHistoryByXuid(xuid, authorization, "modern")
    ]);

    // TODO: We can determine
    // which titles are missing and present in the DB. Once we know which titles
    // are missing and present, we can fetch the ones that are missing.

    return [
      ...userModernTitleHistory.titles.map(this.#sanitizeTitleHistoryEntity),
      ...userLegacyTitleHistory.titles.map(this.#sanitizeTitleHistoryEntity)
    ];
  }

  /**
   * Given a gamertag, ask Xbox what its associated XUID is.
   */
  async fetchXuidFromGamertag(gamertag: string) {
    this.#logger.log(`Fetching XUID for gamertag ${gamertag}`);

    const authorization = await this.#useXboxAuthorization();
    return await getPlayerXUID(gamertag, authorization);
  }

  /**
   * Make a call to Xbox using the system credentials to retrieve
   * a new authorization. This is a prerequisite to calling any
   * Xbox API endpoints.
   */
  async #getNewXboxAuthorization() {
    this.#logger.log("Authenticating with Xbox.");

    const systemUserName = process.env["XBOX_EMAIL"] ?? "";
    const systemPassword = process.env["XBOX_PASSWORD"] ?? "";

    const newAuthentication = await callXboxAuthenticate(
      systemUserName,
      systemPassword
    );

    return Object.freeze(
      newAuthentication as CredentialsAuthenticateInitialResponse
    );
  }

  /**
   * Given a legacy or modern title history entity fetched via
   * the `fetchTitleHistoryByXuid()` query function, map the entity
   * to the `XboxSanitizedTitleHistoryEntity` interface. This gives us
   * a single common interface to work with, as opposed to juggling
   * two different schemas around from different achievement eras.
   */
  #sanitizeTitleHistoryEntity(
    titleHistoryEntity:
      | XboxLegacyTitleHistoryEntity
      | XboxModernTitleHistoryEntity
  ): XboxSanitizedTitleHistoryEntity {
    const platforms: string[] = [];
    let totalPossibleGamerscore = 0;
    let totalUnlockedGamerscore = 0;

    const isModernTitleHistoryEntity = "platform" in titleHistoryEntity;

    if (isModernTitleHistoryEntity) {
      platforms.push(titleHistoryEntity.platform);
      totalPossibleGamerscore = titleHistoryEntity.maxGamerscore;
      totalUnlockedGamerscore = titleHistoryEntity.currentGamerscore;
    } else {
      totalPossibleGamerscore = titleHistoryEntity.totalGamerscore;
      totalUnlockedGamerscore = titleHistoryEntity.currentGamerscore;
    }

    return {
      platforms,
      totalPossibleGamerscore,
      totalUnlockedGamerscore,
      name: titleHistoryEntity.name,
      titleId: titleHistoryEntity.titleId
    };
  }

  /**
   * We don't want to keep logging in over and over when we don't actually
   * need to. This service should always internally hold a valid auth.
   * This method is responsible for either returning the current valid
   * auth or reauthorizing the service.
   */
  async #useXboxAuthorization(): Promise<XBLAuthorization & { xuid: string }> {
    if (!this.#currentAuthorization) {
      this.#currentAuthorization = await this.#getNewXboxAuthorization();
    } else {
      const now = dayjs();
      const authExpirationDate = dayjs(this.#currentAuthorization.expires_on);

      const isCurrentAuthenticationExpired = now.isAfter(authExpirationDate);
      if (isCurrentAuthenticationExpired) {
        this.#logger.log(
          "The current Xbox authentication is expired. Reauthenticating."
        );

        this.#currentAuthorization = await this.#getNewXboxAuthorization();
      }
    }

    return {
      xuid: this.#currentAuthorization.xuid,
      userHash: this.#currentAuthorization.user_hash,
      XSTSToken: this.#currentAuthorization.xsts_token
    };
  }
}
