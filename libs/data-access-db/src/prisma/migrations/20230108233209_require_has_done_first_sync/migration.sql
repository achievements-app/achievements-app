/*
  Warnings:

  - Made the column `hasDoneFirstSync` on table `TrackedAccount` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "TrackedAccount" ALTER COLUMN "hasDoneFirstSync" SET NOT NULL,
ALTER COLUMN "hasDoneFirstSync" SET DEFAULT false;
