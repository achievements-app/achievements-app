export interface FetchXboxTitleHistoryResponse<T> {
  titles: T[];
  pagingInfo: { continuationToken: string; totalRecords: number };
}
