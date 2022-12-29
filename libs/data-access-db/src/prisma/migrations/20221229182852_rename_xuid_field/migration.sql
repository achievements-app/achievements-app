/*
  Warnings:

  - You are about to drop the column `xboxXuid` on the `TrackedAccount` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "TrackedAccount" DROP COLUMN "xboxXuid",
ADD COLUMN     "serviceAccountId" TEXT;
