/*
  Warnings:

  - A unique constraint covering the columns `[gamingService,serviceTitleId]` on the table `Game` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Game_gamingService_serviceTitleId_key" ON "Game"("gamingService", "serviceTitleId");
