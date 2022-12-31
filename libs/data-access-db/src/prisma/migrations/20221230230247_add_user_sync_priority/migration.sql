-- CreateEnum
CREATE TYPE "UserSyncPriority" AS ENUM ('High');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "syncPriority" "UserSyncPriority";
