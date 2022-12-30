import type { SyncUserGameProgressPayload } from "./sync-user-game-progress-payload.model";
import type { SyncUserGamesPayload } from "./sync-user-games-payload.model";
import type { SyncUserMissingGamePayload } from "./sync-user-missing-game-payload.model";

export type SyncQueuePayload =
  | SyncUserMissingGamePayload
  | SyncUserGamesPayload
  | SyncUserGameProgressPayload;
