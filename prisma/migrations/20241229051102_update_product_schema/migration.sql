-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "image" TEXT,
ADD COLUMN     "rating" DECIMAL(65,30) NOT NULL DEFAULT 0;
