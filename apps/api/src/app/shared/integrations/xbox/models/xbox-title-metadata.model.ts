import type { XboxTitleDevice } from "./xbox-title-device.model";

export interface XboxTitleMetadata {
  titleId: string;
  pfn: string;
  bingId: string;
  windowsPhoneProductId: string;
  name: string;
  type: string;
  devices: XboxTitleDevice[];
  displayImage: string;
  mediaItemType: string;
  modernTitleId: string;
  isBundle: boolean;
  xboxLiveTier: string;

  stats: unknown | null;
  gamePass: unknown | null;
  titleHistory: unknown | null;
  titleRecord: unknown | null;
  detail: unknown | null;
  friendsWhoPlayed: unknown | null;
  alternateTitleIds: unknown | null;
  contentBoards: unknown | null;

  achievement?: {
    currentAchievements: number;
    totalAchievements: number;
    currentGamerscore: number;
    totalGamerscore: number;
    progressPercentage: number;
    sourceVersion: number;
  };
  images?: Array<{ url: string; type: string }>;
}
