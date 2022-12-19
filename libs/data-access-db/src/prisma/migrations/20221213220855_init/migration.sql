-- CreateEnum
CREATE TYPE "GamingService" AS ENUM ('RA', 'XBOX', 'PSN');

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "serviceTitleId" TEXT NOT NULL,
    "gamingService" "GamingService" NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);
