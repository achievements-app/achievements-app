export interface FetchXboxTitleHistoryResponse<T> {
  titles: T[];
  pagingInfo: { continuationToken: string | null; totalRecords: number };
}
