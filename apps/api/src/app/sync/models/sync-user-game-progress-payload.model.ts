import type { TrackedAccount } from "@achievements-app/data-access-db";

export interface SyncUserGameProgressPayload {
  storedGameId: string;
  serviceTitleId: string;
  trackedAccount: TrackedAccount;

  serviceReportedEarnedAchievementCount?: number;
  serviceReportedEarnedGamerscore?: number;
}
