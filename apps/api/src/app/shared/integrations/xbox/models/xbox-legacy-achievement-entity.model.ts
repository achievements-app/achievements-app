export interface XboxLegacyAchievementEntity {
  description: string;
  flags: number;
  gamerscore: number;
  id: number;
  imageId: number;
  isRevoked: boolean;
  isSecret: boolean;
  lockedDescription: string;
  name: string;
  platform: number;
  sequence: number;
  timeUnlocked: string;
  titleId: number;
  type: number;
  unlocked: boolean;
  unlockedOnline: boolean;

  rarity: {
    currentCategory: string;
    currentPercentage: number;
  };
}
