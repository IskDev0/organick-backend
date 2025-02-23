-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'unpaid';

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "paymentStatus" SET DEFAULT 'paid';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;
