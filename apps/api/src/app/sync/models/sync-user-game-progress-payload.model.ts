import type { MappedGame } from "@achievements-app/data-access-common-models";
import type { TrackedAccount } from "@achievements-app/data-access-db";

export interface SyncUserGameProgressPayload {
  trackedAccount: TrackedAccount;
  storedGameId: string;
  serviceTitleId: string;

  targetUserGame?: MappedGame;
  serviceReportedEarnedAchievementCount?: number;
  serviceReportedEarnedGamerscore?: number;
}
