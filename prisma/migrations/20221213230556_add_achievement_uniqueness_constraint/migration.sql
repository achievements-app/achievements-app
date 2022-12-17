/*
  Warnings:

  - A unique constraint covering the columns `[gameId,serviceAchievementId]` on the table `GameAchievement` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "GameAchievement_gameId_serviceAchievementId_key" ON "GameAchievement"("gameId", "serviceAchievementId");
