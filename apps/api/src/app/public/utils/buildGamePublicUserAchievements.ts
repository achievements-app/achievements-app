import type {
  Game,
  GameAchievement,
  UserEarnedAchievement
} from "@achievements-app/data-access-db";

import type { PublicUserAchievement } from "../models";

export const buildGamePublicUserAchievements = (
  game: Game,
  allGameAchievements: GameAchievement[],
  allUserEarnedAchievements: Array<
    UserEarnedAchievement & {
      achievement: GameAchievement;
    }
  >
): PublicUserAchievement[] => {
  return allGameAchievements.map((gameAchievement) => {
    const foundEarnedAchievement = allUserEarnedAchievements.find(
      (earnedAchievement) =>
        earnedAchievement.gameAchievementId === gameAchievement.id
    );

    return {
      isEarned: !!foundEarnedAchievement,
      earnedOn: foundEarnedAchievement?.earnedOn?.toISOString(),
      name: gameAchievement.name,
      description: gameAchievement.description,
      gameName: game.name,
      psnGroupId: gameAchievement?.psnGroupId ?? undefined,
      iconUrl: gameAchievement.sourceImageUrl,
      earnedRate: gameAchievement.knownEarnerPercentage,
      gamingService: game.gamingService,
      points: gameAchievement?.vanillaPoints ?? undefined,
      psnTrophyKind: gameAchievement?.psnTrophyKind?.toLowerCase() as any
    };
  });
};
