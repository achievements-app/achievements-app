-- CreateEnum
CREATE TYPE "PsnTrophyKind" AS ENUM ('Bronze', 'Silver', 'Gold', 'Platinum');

-- AlterTable
ALTER TABLE "GameAchievement" ADD COLUMN     "psnTrophyKind" "PsnTrophyKind";
