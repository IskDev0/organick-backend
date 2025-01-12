/*
  Warnings:

  - You are about to drop the `_OrderToUserAddress` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `addressId` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "_OrderToUserAddress" DROP CONSTRAINT "_OrderToUserAddress_A_fkey";

-- DropForeignKey
ALTER TABLE "_OrderToUserAddress" DROP CONSTRAINT "_OrderToUserAddress_B_fkey";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "addressId" TEXT NOT NULL;

-- DropTable
DROP TABLE "_OrderToUserAddress";

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "UserAddress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
