export interface FetchXboxTitleAchievementsResponse<T> {
  achievements: T[];
  pagingInfo: {
    continuationToken: string | null;
    totalRecords: number;
  };

  version?: string;
}
