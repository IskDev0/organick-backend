-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('new', 'pending', 'accepted', 'rejected');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "status" "ApplicationStatus" NOT NULL DEFAULT 'new';
