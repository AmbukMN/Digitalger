-- ─── ОЛОН БАНКНЫ ДАНС ─────────────────────────────────────────────────────
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "logoKey" TEXT,
    "accountNumber" TEXT NOT NULL,
    "iban" TEXT,
    "accountName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BankAccount_isActive_order_idx" ON "BankAccount"("isActive", "order");

-- ─── ХЭРЭГЛЭГЧИЙН МЭДЭГДЭЛ ────────────────────────────────────────────────
CREATE TYPE "NotificationType" AS ENUM (
  'PAYMENT_APPROVED', 'PAYMENT_REJECTED', 'PLAN_ACTIVATED',
  'PLAN_EXPIRING', 'WALLET_TOPUP', 'PROMOTION_APPLIED', 'INFO'
);

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Notification_userId_readAt_createdAt_idx"
  ON "Notification"("userId", "readAt", "createdAt");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── ТӨЛБӨР: ДАНС + БАРИМТ ────────────────────────────────────────────────
ALTER TABLE "Payment" ADD COLUMN "bankAccountId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "bankReceiptKey" TEXT;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bankAccountId_fkey"
  FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ⚠️ ХУУЧИН НЭГ ДАНСЫГ ШИЛЖҮҮЛНЭ (Settings JSON → BankAccount мөр).
-- Админ дахин оруулах шаардлагагүй байхын тулд.
INSERT INTO "BankAccount"(id, "bankName", "accountNumber", "accountName", "isActive", "order", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  COALESCE(value->>'bankName', ''),
  COALESCE(value->>'accountNumber', ''),
  COALESCE(value->>'accountName', ''),
  true, 0, now(), now()
FROM "Settings"
WHERE key = 'bank'
  AND COALESCE(value->>'bankName', '') <> ''
  AND COALESCE(value->>'accountNumber', '') <> '';
