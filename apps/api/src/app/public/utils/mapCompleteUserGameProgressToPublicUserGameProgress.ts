import dayjs from "dayjs";
import minMax from "dayjs/plugin/minMax";

import type {
  GameAchievement,
  UserEarnedAchievement
} from "@achievements-app/data-access-db";

import type { CompleteUserGameProgress } from "@/api/shared/db/models";

import type { PublicUserGameProgress, TrophyTypeCounts } from "../models";
import { buildGamePublicUserAchievements } from "./buildGamePublicUserAchievements";

dayjs.extend(minMax);

export const mapCompleteUserGameProgressToPublicUserGameProgress = ({
  game,
  earnedAchievements
}: CompleteUserGameProgress): PublicUserGameProgress => {
  const lastEarnedOn = earnedAchievements.length
    ? getLastEarnedOn(earnedAchievements)
    : null;

  const completedOn =
    earnedAchievements.length === game.achievements.length
      ? getLastEarnedOn(earnedAchievements)
      : null;

  const gameTrophyTypeCounts =
    game.gamingService === "PSN"
      ? getGameTrophyTypeCounts(game.achievements)
      : undefined;

  const userEarnedTrophyTypeCounts =
    game.gamingService === "PSN"
      ? getUserEarnedTrophyTypeCounts(earnedAchievements)
      : undefined;

  const gameTotalPossiblePoints =
    game.gamingService === "RA" || game.gamingService === "XBOX"
      ? getGameTotalPossiblePoints(game.achievements)
      : undefined;

  return {
    name: game.name,
    platforms: game.gamePlatforms,
    gamingService: game.gamingService,
    imageUrl: game.coverImageUrl,
    lastEarnedOn,
    completedOn,
    gameTrophyTypeCounts,
    userEarnedTrophyTypeCounts,
    gameTotalPossiblePoints,
    achievements: buildGamePublicUserAchievements(
      game,
      game.achievements,
      earnedAchievements
    )
  };
};

const getLastEarnedOn = (
  earnedAchievements: UserEarnedAchievement[]
): string => {
  const allEarnedDates = earnedAchievements
    .filter((earnedAchievement) => earnedAchievement.earnedOn)
    .map((earnedAchievement) => dayjs(earnedAchievement.earnedOn));

  if (allEarnedDates.length === 0) {
    return null;
  }

  return dayjs.max(allEarnedDates).toISOString();
};

const getGameTrophyTypeCounts = (
  allGameAchievements: GameAchievement[]
): TrophyTypeCounts => {
  const allBronzeTrophies = allGameAchievements.filter(
    (achievement) => achievement.psnTrophyKind === "Bronze"
  );
  const allSilverTrophies = allGameAchievements.filter(
    (achievement) => achievement.psnTrophyKind === "Silver"
  );
  const allGoldTrophies = allGameAchievements.filter(
    (achievement) => achievement.psnTrophyKind === "Gold"
  );
  const allPlatinumTrophies = allGameAchievements.filter(
    (achievement) => achievement.psnTrophyKind === "Platinum"
  );

  return {
    bronze: allBronzeTrophies.length,
    silver: allSilverTrophies.length,
    gold: allGoldTrophies.length,
    platinum: allPlatinumTrophies.length
  };
};

const getUserEarnedTrophyTypeCounts = (
  allEarnedAchievements: Array<
    UserEarnedAchievement & { achievement: GameAchievement }
  >
): TrophyTypeCounts => {
  const allEarnedBronzeTrophies = allEarnedAchievements.filter(
    (earnedAchievement) =>
      earnedAchievement.achievement.psnTrophyKind === "Bronze"
  );
  const allEarnedSilverTrophies = allEarnedAchievements.filter(
    (earnedAchievement) =>
      earnedAchievement.achievement.psnTrophyKind === "Silver"
  );
  const allEarnedGoldTrophies = allEarnedAchievements.filter(
    (earnedAchievement) =>
      earnedAchievement.achievement.psnTrophyKind === "Gold"
  );
  const allEarnedPlatinumTrophies = allEarnedAchievements.filter(
    (earnedAchievement) =>
      earnedAchievement.achievement.psnTrophyKind === "Platinum"
  );

  return {
    bronze: allEarnedBronzeTrophies.length,
    silver: allEarnedSilverTrophies.length,
    gold: allEarnedGoldTrophies.length,
    platinum: allEarnedPlatinumTrophies.length
  };
};

const getGameTotalPossiblePoints = (
  allGameAchievements: GameAchievement[]
): number => {
  let points = 0;

  for (const achievement of allGameAchievements) {
    points += achievement.vanillaPoints;
  }

  return points;
};
