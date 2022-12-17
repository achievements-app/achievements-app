/*
  Warnings:

  - You are about to drop the column `userId` on the `UserGameProgress` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[trackedAccountId,gameId]` on the table `UserGameProgress` will be added. If there are existing duplicate values, this will fail.
  - Made the column `gameProgressEntityId` on table `UserEarnedAchievement` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `trackedAccountId` to the `UserGameProgress` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "UserEarnedAchievement" DROP CONSTRAINT "UserEarnedAchievement_gameProgressEntityId_fkey";

-- DropForeignKey
ALTER TABLE "UserGameProgress" DROP CONSTRAINT "UserGameProgress_userId_fkey";

-- DropIndex
DROP INDEX "UserGameProgress_userId_gameId_key";

-- AlterTable
ALTER TABLE "UserEarnedAchievement" ALTER COLUMN "gameProgressEntityId" SET NOT NULL;

-- AlterTable
ALTER TABLE "UserGameProgress" DROP COLUMN "userId",
ADD COLUMN     "trackedAccountId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "UserGameProgress_trackedAccountId_gameId_key" ON "UserGameProgress"("trackedAccountId", "gameId");

-- AddForeignKey
ALTER TABLE "UserGameProgress" ADD CONSTRAINT "UserGameProgress_trackedAccountId_fkey" FOREIGN KEY ("trackedAccountId") REFERENCES "TrackedAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEarnedAchievement" ADD CONSTRAINT "UserEarnedAchievement_gameProgressEntityId_fkey" FOREIGN KEY ("gameProgressEntityId") REFERENCES "UserGameProgress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
