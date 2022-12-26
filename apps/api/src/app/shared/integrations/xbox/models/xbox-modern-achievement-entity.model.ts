export interface XboxModernAchievementEntity {
  id: string;
  serviceConfigId: string;
  name: string;
  titleAssociations: Array<{ name: string; id: number }>;
  progressState: "NotStarted" | "Achieved" | string;

  progression: {
    timeUnlocked: string;
    requirements: Array<{
      id: string;
      current: unknown | null;
      target: string;
      operationType: string;
      valueType: string;
      ruleParticipationType: string;
    }>;
  };

  mediaAssets: Array<{
    name: string;
    type: string;
    url: string;
  }>;

  platforms: string[];
  isSecret: boolean;
  description: string;
  lockedDescription: string;
  productId: string;
  achievementType: string;
  participationType: string;
  timeWindow: unknown | null;

  rewards: Array<{
    name: unknown | null;
    description: unknown | null;
    value: string;
    type: "Gamerscore" | string;
    mediaAsset: unknown | null;
    valueType: "Int" | string;
  }>;

  estimatedTime: string;
  deeplink: string;
  isRevoked: boolean;

  rarity: {
    currentCategory: string;
    currentPercentage: number;
  };
}
