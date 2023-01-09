/*
  Warnings:

  - You are about to drop the column `hasDoneFirstSync` on the `TrackedAccount` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "TrackedAccount" DROP COLUMN "hasDoneFirstSync";
