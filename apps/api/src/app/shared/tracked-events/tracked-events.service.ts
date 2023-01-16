import { Injectable, Logger } from "@nestjs/common";
import dayjs from "dayjs";

import { TrackedEventKind } from "@achievements-app/data-access-db";

import { DbService } from "@/api/shared/db/db.service";

import type {
  RetroachievementsHundredPointUnlockEvent,
  RetroachievementsNewMasteryEvent,
  XboxNewCompletionEvent
} from "./models";

@Injectable()
export class TrackedEventsService {
  #logger = new Logger(TrackedEventsService.name);

  constructor(private readonly dbService: DbService) {}

  async trackRetroachievementsHundredPointUnlocks(
    trackedAccountId: string,
    storedGameId: string,
    serviceAchievementId: string,
    reportedTotalEarnerCount: number
  ) {
    this.#logger.log(
      `Adding new ${TrackedEventKind.RA_HundredPointAchievementUnlock} event for ${trackedAccountId}:${storedGameId}`
    );

    const storedAchievement = await this.dbService.db.gameAchievement.findFirst(
      {
        where: { serviceAchievementId }
      }
    );

    const canReportEvent = await this.#canReportEventsForTrackedAccount(
      trackedAccountId
    );
    if (!canReportEvent) {
      this.#logger.error(
        `Unable to report event for ${trackedAccountId}. Account is not old enough.`
      );

      return;
    }

    const constructedEventData =
      await this.#buildRetroachievementsHundredPointUnlockEvent(
        trackedAccountId,
        storedGameId,
        storedAchievement.id,
        reportedTotalEarnerCount
      );

    await this.dbService.db.trackedEvent.create({
      data: {
        trackedAccountId,
        kind: "RA_HundredPointAchievementUnlock",
        eventData: constructedEventData
      }
    });

    this.#logger.log(
      `Added new ${TrackedEventKind.RA_HundredPointAchievementUnlock} event for ${trackedAccountId}:${storedGameId}:${storedAchievement.id}`
    );
  }

  /**
   * Given a trackedAccountId and a storedGameId, store a reported mastery
   * for the game. Note that we do not actually validate if the game was
   * mastered. That is the responsibility of the method caller.
   */
  async trackRetroachievementsNewMastery(
    trackedAccountId: string,
    storedGameId: string
  ) {
    this.#logger.log(
      `Adding new ${TrackedEventKind.RA_NewMastery} event for ${trackedAccountId}:${storedGameId}`
    );

    const canReportEvent = await this.#canReportEventsForTrackedAccount(
      trackedAccountId
    );
    if (!canReportEvent) {
      this.#logger.error(
        `Unable to report event for ${trackedAccountId}. Account is not old enough.`
      );

      return;
    }

    const constructedEventData =
      await this.#buildRetroachievementsNewMasteryEvent(
        trackedAccountId,
        storedGameId
      );

    await this.dbService.db.trackedEvent.create({
      data: {
        trackedAccountId,
        kind: "RA_NewMastery",
        eventData: constructedEventData
      }
    });

    this.#logger.log(
      `Added new ${TrackedEventKind.RA_NewMastery} event for ${trackedAccountId}:${constructedEventData.game.name}:${storedGameId}`
    );
  }

  async trackXboxNewCompletion(trackedAccountId: string, storedGameId: string) {
    this.#logger.log(
      `Adding new XBOX_NewCompletion event for ${trackedAccountId}:${storedGameId}`
    );

    const canReportEvent = await this.#canReportEventsForTrackedAccount(
      trackedAccountId
    );
    if (!canReportEvent) {
      this.#logger.error(
        `Unable to report event for ${trackedAccountId}. Account is not old enough.`
      );

      return;
    }

    const constructedEventData = await this.#buildXboxNewCompletionEvent(
      trackedAccountId,
      storedGameId
    );

    await this.dbService.db.trackedEvent.create({
      data: {
        trackedAccountId,
        kind: "XBOX_NewCompletion",
        eventData: constructedEventData
      }
    });

    this.#logger.log(
      `Added new XBOX_NewCompletion event for ${trackedAccountId}:${constructedEventData.game.name}:${storedGameId}`
    );
  }

  async #buildRetroachievementsHundredPointUnlockEvent(
    trackedAccountId: string,
    storedGameId: string,
    storedAchievementId: string,
    reportedTotalEarnerCount: number
  ): Promise<RetroachievementsHundredPointUnlockEvent> {
    const foundNeededGameDetails = await this.dbService.db.game.findFirst({
      where: { id: storedGameId },
      select: {
        name: true,
        gamePlatforms: true,
        serviceTitleId: true
      }
    });

    const consoleName =
      foundNeededGameDetails.gamePlatforms?.[
        foundNeededGameDetails.gamePlatforms.length - 1
      ] ?? "Unknown";

    const foundNeededAchievementDetails =
      await this.dbService.db.gameAchievement.findFirst({
        where: { id: storedAchievementId },
        select: {
          name: true,
          description: true,
          serviceAchievementId: true
        }
      });

    const allStoredUserHundredPointAchievements =
      await this.dbService.db.userEarnedAchievement.findMany({
        where: {
          achievement: {
            game: { gamingService: "RA" },
            vanillaPoints: { gte: 100 }
          }
        },
        select: { id: true }
      });

    const siteUser = await this.dbService.getSiteUserFromTrackedAccountId(
      trackedAccountId
    );

    return {
      appUserName: siteUser.user.userName,
      trackedAccountUserName: siteUser.accountUserName,
      totalRaUnlockerCount: reportedTotalEarnerCount,
      userHundredPointUnlocksCount:
        allStoredUserHundredPointAchievements.length,
      game: {
        consoleName,
        name: foundNeededGameDetails.name,
        serviceTitleId: foundNeededGameDetails.serviceTitleId
      },
      achievement: {
        name: foundNeededAchievementDetails.name,
        description: foundNeededAchievementDetails.description,
        serviceAchievementId: foundNeededAchievementDetails.serviceAchievementId
      }
    };
  }

  async #buildRetroachievementsNewMasteryEvent(
    trackedAccountId: string,
    storedGameId: string
  ): Promise<RetroachievementsNewMasteryEvent> {
    const foundNeededGameDetails = await this.dbService.db.game.findFirst({
      where: { id: storedGameId },
      select: {
        name: true,
        gamePlatforms: true,
        serviceTitleId: true,
        achievements: {
          orderBy: {
            ratioPoints: "desc"
          },
          select: {
            name: true,
            description: true,
            vanillaPoints: true,
            ratioPoints: true
          }
        }
      }
    });

    if (!foundNeededGameDetails) {
      this.#logger.error(
        `Couldn't find game details for storedGameId ${storedGameId}`
      );
      throw new Error("Unable to find game details for new tracked event.");
    }

    if (foundNeededGameDetails.achievements.length === 0) {
      this.#logger.error(
        `Tried to report a mastery for storedGameId ${storedGameId} that has 0 stored achievements`
      );
      throw new Error("No stored achievements for new tracked event.");
    }

    const consoleName =
      foundNeededGameDetails.gamePlatforms?.[
        foundNeededGameDetails.gamePlatforms.length - 1
      ] ?? "Unknown";

    let totalGamePoints = 0;
    for (const achievement of foundNeededGameDetails.achievements) {
      totalGamePoints += achievement.vanillaPoints;
    }

    const userMasteryCount =
      await this.dbService.computeGamingServiceCompletionCount(
        trackedAccountId,
        "RA"
      );

    const siteUser = await this.dbService.getSiteUserFromTrackedAccountId(
      trackedAccountId
    );

    return {
      totalGamePoints,
      userMasteryCount,
      appUserName: siteUser.user.userName,
      trackedAccountUserName: siteUser.accountUserName,
      game: {
        consoleName,
        name: foundNeededGameDetails.name,
        serviceTitleId: foundNeededGameDetails.serviceTitleId
      },
      hardestAchievement: {
        name: foundNeededGameDetails.achievements[0].name,
        description: foundNeededGameDetails.achievements[0].description,
        points: foundNeededGameDetails.achievements[0].vanillaPoints
      }
    };
  }

  async #buildXboxNewCompletionEvent(
    trackedAccountId: string,
    storedGameId: string
  ): Promise<XboxNewCompletionEvent> {
    const foundNeededGameDetails = await this.dbService.db.game.findFirst({
      where: { id: storedGameId },
      select: {
        name: true,
        gamePlatforms: true,
        serviceTitleId: true,
        achievements: {
          orderBy: {
            vanillaPoints: "desc"
          },
          select: {
            name: true,
            description: true,
            vanillaPoints: true
          }
        }
      }
    });

    if (!foundNeededGameDetails) {
      this.#logger.error(
        `Couldn't find game details for storedGameId ${storedGameId}`
      );
      throw new Error("Unable to find game details for new tracked event.");
    }

    if (foundNeededGameDetails.achievements.length === 0) {
      this.#logger.error(
        `Tried to report a mastery for storedGameId ${storedGameId} that has 0 stored achievements`
      );
      throw new Error("No stored achievements for new tracked event.");
    }

    let totalGamePoints = 0;
    for (const achievement of foundNeededGameDetails.achievements) {
      totalGamePoints += achievement.vanillaPoints;
    }

    const userCompletionCount =
      await this.dbService.computeGamingServiceCompletionCount(
        trackedAccountId,
        "XBOX"
      );

    const siteUser = await this.dbService.getSiteUserFromTrackedAccountId(
      trackedAccountId
    );

    return {
      totalGamePoints,
      userCompletionCount,
      appUserName: siteUser.user.userName,
      trackedAccountUserName: siteUser.accountUserName,
      game: {
        name: foundNeededGameDetails.name,
        serviceTitleId: foundNeededGameDetails.serviceTitleId
      },
      hardestAchievement: {
        name: foundNeededGameDetails.achievements[0].name,
        description: foundNeededGameDetails.achievements[0].description,
        points: foundNeededGameDetails.achievements[0].vanillaPoints
      }
    };
  }

  async #canReportEventsForTrackedAccount(trackedAccountId: string) {
    const foundTrackedAccount =
      await this.dbService.db.trackedAccount.findFirst({
        where: { id: trackedAccountId },
        select: { createdAt: true }
      });

    // We require the TrackedAccount to be at least 8 hours old.
    const now = dayjs();
    const createdAt = dayjs(foundTrackedAccount.createdAt);

    return now.diff(createdAt, "hours") > 8;
  }
}
