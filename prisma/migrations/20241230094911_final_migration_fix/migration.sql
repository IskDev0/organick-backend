/*
  Warnings:

  - You are about to drop the column `rating` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `UserAddress` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `UserAddress` table. All the data in the column will be lost.
  - You are about to drop the `ShippingAddress` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ShippingAddress" DROP CONSTRAINT "ShippingAddress_orderId_fkey";

-- DropForeignKey
ALTER TABLE "ShippingAddress" DROP CONSTRAINT "ShippingAddress_userId_fkey";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "rating";

-- AlterTable
ALTER TABLE "UserAddress" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt";

-- DropTable
DROP TABLE "ShippingAddress";

-- CreateTable
CREATE TABLE "_OrderToUserAddress" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_OrderToUserAddress_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_OrderToUserAddress_B_index" ON "_OrderToUserAddress"("B");

-- AddForeignKey
ALTER TABLE "_OrderToUserAddress" ADD CONSTRAINT "_OrderToUserAddress_A_fkey" FOREIGN KEY ("A") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OrderToUserAddress" ADD CONSTRAINT "_OrderToUserAddress_B_fkey" FOREIGN KEY ("B") REFERENCES "UserAddress"("id") ON DELETE CASCADE ON UPDATE CASCADE;
