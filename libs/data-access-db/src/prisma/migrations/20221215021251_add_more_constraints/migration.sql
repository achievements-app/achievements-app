/*
  Warnings:

  - A unique constraint covering the columns `[gamingService,accountUserName]` on the table `TrackedAccount` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,gameId]` on the table `UserGameProgress` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "TrackedAccount_gamingService_accountUserName_key" ON "TrackedAccount"("gamingService", "accountUserName");

-- CreateIndex
CREATE UNIQUE INDEX "UserGameProgress_userId_gameId_key" ON "UserGameProgress"("userId", "gameId");
