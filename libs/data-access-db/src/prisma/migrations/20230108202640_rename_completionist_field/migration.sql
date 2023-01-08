/*
  Warnings:

  - You are about to drop the column `knownCompletionistCount` on the `Game` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Game" DROP COLUMN "knownCompletionistCount",
ADD COLUMN     "knownCompletionistRate" INTEGER;
