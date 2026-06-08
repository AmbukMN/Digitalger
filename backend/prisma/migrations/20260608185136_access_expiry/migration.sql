-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "accessDays" INTEGER,
ADD COLUMN     "accessType" TEXT NOT NULL DEFAULT 'LIFETIME';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "paidAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_userId_expiresAt_idx" ON "Order"("userId", "expiresAt");

