import { TrackedAccount } from "@prisma/client";

export interface SyncUserGameProgressPayload {
  trackedAccount: TrackedAccount;
  storedGameId: string;
  serviceTitleId: string;
  serviceReportedEarnedAchievementCount: number;
}
