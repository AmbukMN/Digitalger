-- Имэйлийн хүргэлт/нээлтийн хяналт (AWS SES Configuration Set → SNS)
ALTER TABLE "EmailLog" ADD COLUMN IF NOT EXISTS "messageId"   TEXT;
ALTER TABLE "EmailLog" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);
ALTER TABLE "EmailLog" ADD COLUMN IF NOT EXISTS "openedAt"    TIMESTAMP(3);
ALTER TABLE "EmailLog" ADD COLUMN IF NOT EXISTS "openCount"   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmailLog" ADD COLUMN IF NOT EXISTS "clickedAt"   TIMESTAMP(3);
ALTER TABLE "EmailLog" ADD COLUMN IF NOT EXISTS "clickCount"  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmailLog" ADD COLUMN IF NOT EXISTS "bouncedAt"   TIMESTAMP(3);
ALTER TABLE "EmailLog" ADD COLUMN IF NOT EXISTS "bounceType"  TEXT;

-- ⚠️ SNS нь нэг үйл явдлыг ОЛОН УДАА илгээж болно (at-least-once).
--    Давхардлыг DB түвшинд хаана.
CREATE UNIQUE INDEX IF NOT EXISTS "EmailLog_messageId_key" ON "EmailLog"("messageId");

CREATE INDEX IF NOT EXISTS "EmailLog_openedAt_idx"          ON "EmailLog"("openedAt");
CREATE INDEX IF NOT EXISTS "EmailLog_template_openedAt_idx" ON "EmailLog"("template", "openedAt");
