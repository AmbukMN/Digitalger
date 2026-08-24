-- ХАДГАЛСАН КАРТ + АВТОМАТ СУНГАЛТ (Bonum tokenize / recurring)
--
-- ⚠️ Картын ДУГААР хадгалахгүй — зөвхөн Bonum-ын токен + маск.
-- ⚠️ Бүх шинэ багана DEFAULT-тай эсвэл NULL зөвшөөрсөн тул одоо байгаа
--    мөрүүд эвдрэхгүй (production дээр аюулгүй).

CREATE TABLE "SavedCard" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "token"     TEXT NOT NULL,
    "mask"      TEXT NOT NULL,
    "bank"      TEXT NOT NULL DEFAULT '',
    "expiry"    TEXT NOT NULL DEFAULT '',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavedCard_token_key" ON "SavedCard"("token");
CREATE INDEX "SavedCard_userId_createdAt_idx" ON "SavedCard"("userId", "createdAt");

ALTER TABLE "SavedCard" ADD CONSTRAINT "SavedCard_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Subscription — автомат сунгалтын талбарууд
-- ⚠️ autoRenew DEFAULT false: одоо байгаа захиалгууд нь QPay/данс/хэтэвчээр
--    авагдсан бөгөөд карт БАЙХГҮЙ тул автоматаар татах боломжгүй.
ALTER TABLE "Subscription" ADD COLUMN "autoRenew"            BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Subscription" ADD COLUMN "cardId"               TEXT;
ALTER TABLE "Subscription" ADD COLUMN "autoRenewCancelledAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "renewFailCount"       INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subscription" ADD COLUMN "lastRenewTriedAt"     TIMESTAMP(3);

-- ⚠️ SET NULL — карт устгахад захиалга УСТАХГҮЙ, зөвхөн сунгалт зогсоно
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "SavedCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Сунгалтын cron-ы хайлт: «autoRenew=true БА удахгүй дуусах»
CREATE INDEX "Subscription_autoRenew_expiresAt_idx" ON "Subscription"("autoRenew", "expiresAt");

-- Хэрэглэгч «Автомат сунгах» чеклэсэн эсэх (карт ирмэгц сунгалтыг асаахад)
ALTER TABLE "Payment" ADD COLUMN "autoRenewRequested" BOOLEAN NOT NULL DEFAULT false;
