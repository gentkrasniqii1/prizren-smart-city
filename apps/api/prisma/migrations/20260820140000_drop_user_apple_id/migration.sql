-- DropIndex
DROP INDEX IF EXISTS "User_appleId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN IF EXISTS "appleId";
