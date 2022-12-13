import { Controller, Get } from "@nestjs/common";

import { RetroachievementsService } from "../integrations/retroachievements/retroachievements.service";

@Controller("sync")
export class SyncController {
  constructor(private readonly retroachievements: RetroachievementsService) {}

  @Get()
  async ping() {
    await this.retroachievements.queueLoadUserGames("WCopeland");

    return { status: "ok" };
  }
}
