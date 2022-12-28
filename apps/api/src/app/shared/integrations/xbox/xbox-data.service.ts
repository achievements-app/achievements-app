import { Injectable, OnModuleInit } from "@nestjs/common";
import { type XBLAuthorization, getPlayerXUID } from "@xboxreplay/xboxlive-api";
import {
  type CredentialsAuthenticateInitialResponse,
  authenticate as callXboxAuthenticate
} from "@xboxreplay/xboxlive-auth";
import dayjs from "dayjs";

import { Logger } from "@/api/shared/logger/logger.service";

import type {
  FetchXboxTitleAchievementsResponse,
  FetchXboxTitleMetadataResponse,
  XboxDeepGameInfo,
  XboxLegacyAchievementEntity,
  XboxLegacyTitleHistoryEntity,
  XboxModernAchievementEntity,
  XboxModernTitleHistoryEntity,
  XboxSanitizedAchievementEntity,
  XboxSanitizedTitleHistoryEntity
} from "./models";
import { fetchTitleAchievements } from "./queries/fetchTitleAchievements";
import { fetchTitleHistoryByXuid } from "./queries/fetchTitleHistoryByXuid";
import { fetchTitleMetadata } from "./queries/fetchTitleMetadata";
import { buildLegacyAchievementImageUrl } from "./utils/buildLegacyAchievementImageUrl";

@Injectable()
export class XboxDataService implements OnModuleInit {
  #currentAuthorization: Readonly<CredentialsAuthenticateInitialResponse>;
  #logger = new Logger(XboxDataService.name);

  async onModuleInit() {
    this.#getNewXboxAuthorization();
  }

  async fetchDeepGameInfo(
    xuid: string,
    xboxTitleId: string,
    achievementsSchemaKind: "legacy" | "modern"
  ): Promise<XboxDeepGameInfo> {
    // Make these calls at the same time to improve performance.
    const parallelApiCalls = [
      this.fetchTitleMetadata(xuid, xboxTitleId),
      this.fetchTitleAchievementsForTitleId(
        xuid,
        Number(xboxTitleId),
        achievementsSchemaKind
      )
    ];

    const [titleMetadata, titleAchievements] = (await Promise.all(
      parallelApiCalls
    )) as [FetchXboxTitleMetadataResponse, XboxSanitizedAchievementEntity[]];

    return {
      ...titleMetadata.titles[0],
      achievementsSchemaKind,
      achievements: titleAchievements
    };
  }

  /**
   * Given a user's XUID and a game's titleId, returns metadata about
   * that game. This only fetches high-level metadata about the game.
   * This call _does not_ fetch an achievement list.
   */
  async fetchTitleMetadata(xuid: string, titleId: string) {
    const authorization = await this.#useXboxAuthorization();
    return await fetchTitleMetadata({ xuid, titleId }, authorization);
  }

  /**
   * Given an Xbox title ID, probably retrieved via
   * `fetchCompleteTitleHistoryByXuid()`, retrieve the
   * complete list of achievements for that title.
   */
  async fetchTitleAchievementsForTitleId(
    xuid: string,
    titleId: number,
    titleKind: "legacy" | "modern"
  ): Promise<XboxSanitizedAchievementEntity[]> {
    const authorization = await this.#useXboxAuthorization();

    const {
      achievements
    }: FetchXboxTitleAchievementsResponse<
      XboxLegacyAchievementEntity | XboxModernAchievementEntity
    > = await fetchTitleAchievements(
      { xuid, titleId },
      authorization,
      titleKind as any
    );

    return achievements.map(this.#sanitizeTitleAchievementEntity);
  }

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
      fetchTitleHistoryByXuid({ xuid }, authorization, "legacy"),
      fetchTitleHistoryByXuid({ xuid }, authorization, "modern")
    ]);

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

    console.log({ systemUserName, systemPassword });

    const newAuthentication = await callXboxAuthenticate(
      systemUserName,
      systemPassword
    );

    return Object.freeze(
      newAuthentication as CredentialsAuthenticateInitialResponse
    );
  }

  /**
   * Given a legacy or modern title achievement entity fetched
   * via the `fetchTitleAchievements()` query function, map the entity
   * to the `XboxSanitizedAchievementEntity` interface. This gives us
   * a single common interface to work with, as opposed to juggling
   * two different schemas around from different achievement eras.
   */
  #sanitizeTitleAchievementEntity(
    titleAchievementEntity:
      | XboxLegacyAchievementEntity
      | XboxModernAchievementEntity
  ): XboxSanitizedAchievementEntity {
    let possibleGamerscore = 0;
    let imageUrl: string | null = null;
    let timeUnlocked: string;

    const isModernAchievementEntity =
      "serviceConfigId" in titleAchievementEntity;

    if (isModernAchievementEntity) {
      if (titleAchievementEntity.progressState === "Achieved") {
        timeUnlocked = titleAchievementEntity.progression.timeUnlocked;
      }

      const foundGamerscoreReward = titleAchievementEntity.rewards.find(
        (reward) => reward.type === "Gamerscore"
      );
      if (foundGamerscoreReward) {
        possibleGamerscore = Number(foundGamerscoreReward.value);
      }

      const foundIconMediaAsset = titleAchievementEntity.mediaAssets.find(
        (mediaAsset) => mediaAsset.type === "Icon"
      );
      if (foundIconMediaAsset) {
        imageUrl = foundIconMediaAsset.url;
      }
    } else {
      possibleGamerscore = titleAchievementEntity.gamerscore;

      if (
        titleAchievementEntity.unlocked ||
        titleAchievementEntity.unlockedOnline
      ) {
        timeUnlocked = titleAchievementEntity.timeUnlocked;
      }

      imageUrl = buildLegacyAchievementImageUrl(
        titleAchievementEntity.titleId,
        titleAchievementEntity.imageId
      );
    }

    return {
      imageUrl,
      timeUnlocked,
      name: titleAchievementEntity.name,
      id: String(titleAchievementEntity.id),
      description: titleAchievementEntity.description,
      gamerscore: possibleGamerscore,
      rarityPercentage: titleAchievementEntity.rarity.currentPercentage
    };
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
    let totalPossibleGamerscore = 0;
    let totalUnlockedGamerscore = 0;

    const isModernTitleHistoryEntity = "platform" in titleHistoryEntity;

    if (isModernTitleHistoryEntity) {
      totalPossibleGamerscore = titleHistoryEntity.maxGamerscore;
      totalUnlockedGamerscore = titleHistoryEntity.currentGamerscore;
    } else {
      totalPossibleGamerscore = titleHistoryEntity.totalGamerscore;
      totalUnlockedGamerscore = titleHistoryEntity.currentGamerscore;
    }

    return {
      totalPossibleGamerscore,
      totalUnlockedGamerscore,
      name: titleHistoryEntity.name,
      titleId: titleHistoryEntity.titleId,
      titleKind: isModernTitleHistoryEntity ? "modern" : "legacy"
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
