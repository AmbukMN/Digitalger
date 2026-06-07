-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "lastOrderAt" TIMESTAMP(3),
ADD COLUMN     "marketingOptOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reactivationSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "notifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "discountPushSentAt" TIMESTAMP(3),
ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EmailOpen" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "campaign" TEXT NOT NULL,
    "refId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailOpen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailOpen_campaign_openedAt_idx" ON "EmailOpen"("campaign", "openedAt");

-- CreateIndex
CREATE INDEX "EmailOpen_email_campaign_idx" ON "EmailOpen"("email", "campaign");

