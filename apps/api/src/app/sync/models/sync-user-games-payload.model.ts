import type { TrackedAccount } from "@achievements-app/data-access-db";

export interface SyncUserGamesPayload {
  trackedAccount: TrackedAccount;

  /**
   * To save bandwidth, we may only want to sync a
   * user's 10 most recently played games.
   */
  syncKind: "full" | "partial";
}
