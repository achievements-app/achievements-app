import type { GamingService } from "@achievements-app/data-access-db";

export interface AddTrackedAccountPayload {
  gamingService: GamingService;
  userName: string;
  serviceAccountUserName: string;
}
