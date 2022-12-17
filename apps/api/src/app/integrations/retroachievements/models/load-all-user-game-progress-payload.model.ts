export interface LoadAllUserGameProgressPayload {
  userName: string;
  ids: Array<{ gameId: string; serviceTitleId: string }>;
}
