import type { TrackedAccount } from "@achievements-app/data-access-db";

export interface SyncUserGamesPayload {
  trackedAccount: TrackedAccount;
}
