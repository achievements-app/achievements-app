export interface XboxSanitizedAchievementEntity {
  description: string;
  gamerscore: number;
  id: string;
  imageUrl: string | null;
  name: string;
  rarityPercentage: number;

  timeUnlocked?: string;
}
