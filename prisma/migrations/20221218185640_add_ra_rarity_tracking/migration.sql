/*
  Warnings:

  - You are about to drop the column `serviceEarnedPercentage` on the `GameAchievement` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "knownPlayerCount" INTEGER;

-- AlterTable
ALTER TABLE "GameAchievement" DROP COLUMN "serviceEarnedPercentage",
ADD COLUMN     "knownEarnerCount" INTEGER;
