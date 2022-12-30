import type { MappedGame } from "@achievements-app/data-access-common-models";
import type { TrackedAccount } from "@achievements-app/data-access-db";

export interface SyncUserMissingGamePayload {
  trackedAccount: TrackedAccount;
  userGame: MappedGame;
}
