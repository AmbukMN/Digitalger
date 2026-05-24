-- AlterTable
ALTER TABLE "ZipJob" ADD COLUMN "productId" TEXT;

-- CreateIndex
CREATE INDEX "ZipJob_userId_productId_status_idx" ON "ZipJob"("userId", "productId", "status");
