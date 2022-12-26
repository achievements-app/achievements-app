export interface XboxTitleHistoryResponse<T> {
  titles: T[];
  pagingInfo: { continuationToken: string; totalRecords: number };
}
