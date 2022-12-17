import { TrackedAccount } from "@prisma/client";

export interface SyncUserGamesPayload {
  trackedAccount: TrackedAccount;
}
