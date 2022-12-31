import type { SyncPsnGamePayload } from "./sync-psn-game-payload.model";
import type { SyncUserGameProgressPayload } from "./sync-user-game-progress-payload.model";
import type { SyncUserGamesPayload } from "./sync-user-games-payload.model";

export type SyncQueuePayload =
  | SyncPsnGamePayload
  | SyncUserGamesPayload
  | SyncUserGameProgressPayload;
