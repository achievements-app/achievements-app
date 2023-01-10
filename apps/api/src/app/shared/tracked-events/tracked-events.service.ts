import { Injectable, Logger } from "@nestjs/common";
import dayjs from "dayjs";

import { TrackedEventKind } from "@achievements-app/data-access-db";

import { DbService } from "@/api/shared/db/db.service";

import type { RetroachievementsNewMasteryEvent } from "./models";

@Injectable()
export class TrackedEventsService {
  #logger = new Logger(TrackedEventsService.name);

  constructor(private readonly dbService: DbService) {}

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
        `Unable to report new mastery for ${trackedAccountId}. Account is not old enough.`
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

    return {
      totalGamePoints,
      userMasteryCount,
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
