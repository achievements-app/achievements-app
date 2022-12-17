-- CreateTable
CREATE TABLE "GameAchievement" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "serviceAchievementId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "vanillaPoints" INTEGER,
    "ratioPoints" INTEGER,
    "sourceImageUrl" TEXT,
    "serviceEarnedPercentage" DOUBLE PRECISION,
    "gameId" TEXT NOT NULL,

    CONSTRAINT "GameAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGameProgress" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,

    CONSTRAINT "UserGameProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEarnedAchievement" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "earnedOn" TIMESTAMP(3) NOT NULL,
    "gameAchievementId" TEXT NOT NULL,
    "gameProgressEntityId" TEXT,

    CONSTRAINT "UserEarnedAchievement_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GameAchievement" ADD CONSTRAINT "GameAchievement_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGameProgress" ADD CONSTRAINT "UserGameProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGameProgress" ADD CONSTRAINT "UserGameProgress_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEarnedAchievement" ADD CONSTRAINT "UserEarnedAchievement_gameAchievementId_fkey" FOREIGN KEY ("gameAchievementId") REFERENCES "GameAchievement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEarnedAchievement" ADD CONSTRAINT "UserEarnedAchievement_gameProgressEntityId_fkey" FOREIGN KEY ("gameProgressEntityId") REFERENCES "UserGameProgress"("id") ON DELETE SET NULL ON UPDATE CASCADE;
