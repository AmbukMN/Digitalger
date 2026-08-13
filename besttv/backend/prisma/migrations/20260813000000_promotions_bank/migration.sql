-- ─── УРАМШУУЛЛЫН СИСТЕМ ───────────────────────────────────────────────────
CREATE TYPE "PromotionType" AS ENUM ('EXTRA_DAYS', 'DISCOUNT', 'GIFT_PLAN', 'WALLET_BONUS');

CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortText" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "type" "PromotionType" NOT NULL,
    "bonusDays" INTEGER,
    "discountType" "DiscountType",
    "discountValue" INTEGER,
    "giftPlanId" TEXT,
    "giftDays" INTEGER,
    "minTopup" INTEGER,
    "bonusAmount" INTEGER,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "maxPerUser" INTEGER NOT NULL DEFAULT 1,
    "newUsersOnly" BOOLEAN NOT NULL DEFAULT false,
    "blockCoupons" BOOLEAN NOT NULL DEFAULT false,
    "bannerKey" TEXT,
    "bannerMobileKey" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Promotion_isActive_startsAt_endsAt_idx" ON "Promotion"("isActive", "startsAt", "endsAt");
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_giftPlanId_fkey"
  FOREIGN KEY ("giftPlanId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PromotionPlan" (
    "promotionId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    CONSTRAINT "PromotionPlan_pkey" PRIMARY KEY ("promotionId","planId")
);
CREATE INDEX "PromotionPlan_planId_idx" ON "PromotionPlan"("planId");
ALTER TABLE "PromotionPlan" ADD CONSTRAINT "PromotionPlan_promotionId_fkey"
  FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionPlan" ADD CONSTRAINT "PromotionPlan_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PromotionRedemption" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentId" TEXT,
    "valueGiven" INTEGER NOT NULL DEFAULT 0,
    "daysGiven" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromotionRedemption_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PromotionRedemption_promotionId_userId_idx" ON "PromotionRedemption"("promotionId", "userId");
CREATE INDEX "PromotionRedemption_userId_idx" ON "PromotionRedemption"("userId");
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_promotionId_fkey"
  FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── ДАНСААР ТӨЛӨХ + УРАМШУУЛЛЫН SNAPSHOT ─────────────────────────────────
ALTER TABLE "Payment" ADD COLUMN "bankReference" TEXT;
ALTER TABLE "Payment" ADD COLUMN "bankClaimedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "bankReviewedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "bankRejectReason" TEXT;
ALTER TABLE "Payment" ADD COLUMN "promotionId" TEXT;

CREATE UNIQUE INDEX "Payment_bankReference_key" ON "Payment"("bankReference");
CREATE INDEX "Payment_bankClaimedAt_idx" ON "Payment"("bankClaimedAt");
