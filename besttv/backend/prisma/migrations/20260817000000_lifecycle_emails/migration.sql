-- Re-engagement: хувийн купон + админаас засах имэйлийн загвар

-- ⚠️ Хувийн купон — нийтлэг код Facebook-т тарахаас сэргийлнэ
ALTER TABLE "Coupon" ADD COLUMN "userId" TEXT;
ALTER TABLE "Coupon" ADD COLUMN "campaign" TEXT;

ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Coupon_userId_campaign_idx" ON "Coupon"("userId", "campaign");

-- Админаас засах имэйлийн загвар
CREATE TABLE "EmailTemplateOverride" (
    "id" TEXT NOT NULL,
    "campaign" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "heading" TEXT NOT NULL DEFAULT '',
    "bodyHtml" TEXT NOT NULL DEFAULT '',
    "ctaText" TEXT NOT NULL DEFAULT '',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "couponPercent" INTEGER NOT NULL DEFAULT 0,
    "couponDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplateOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailTemplateOverride_campaign_key" ON "EmailTemplateOverride"("campaign");
