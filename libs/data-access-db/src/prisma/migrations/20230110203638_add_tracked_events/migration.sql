-- CreateEnum
CREATE TYPE "TrackedEventKind" AS ENUM ('RA_NewMastery');

-- CreateTable
CREATE TABLE "TrackedEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" "TrackedEventKind" NOT NULL,
    "eventData" JSONB NOT NULL,
    "trackedAccountId" TEXT NOT NULL,

    CONSTRAINT "TrackedEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TrackedEvent" ADD CONSTRAINT "TrackedEvent_trackedAccountId_fkey" FOREIGN KEY ("trackedAccountId") REFERENCES "TrackedAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
