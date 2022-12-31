/*
  Warnings:

  - You are about to drop the column `psnGroupId` on the `Game` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Game" DROP COLUMN "psnGroupId";

-- AlterTable
ALTER TABLE "GameAchievement" ADD COLUMN     "psnGroupId" TEXT;
