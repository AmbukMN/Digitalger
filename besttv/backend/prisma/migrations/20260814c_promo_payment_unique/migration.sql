-- ⚠️ Нэг төлбөрт НЭГ Л УДАА урамшуулал. adminMarkPaid (FAILED→PAID)
-- дахин дуудагдвал бонус хоног + бэлэг багц ДАХИН олгогдож байв.
-- Rental.paymentId @unique яг ижил шалтгаанаар тавигдсан.
--
-- ⚠️ Давхардсан мөр байвал эхлээд цэвэрлэнэ (хамгийн эртнийхийг үлдээнэ).
DELETE FROM "PromotionRedemption" a
USING "PromotionRedemption" b
WHERE a."paymentId" IS NOT NULL
  AND a."paymentId" = b."paymentId"
  AND a."createdAt" > b."createdAt";

CREATE UNIQUE INDEX IF NOT EXISTS "PromotionRedemption_paymentId_key"
  ON "PromotionRedemption"("paymentId");

-- ⚠️ Cron-ы гүйцэтгэл: reconcilePending (5 мин) + expireStalePayments (цаг)
CREATE INDEX IF NOT EXISTS "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");
-- ⚠️ video-recovery cron (10 мин) — Episode-д индекс ОГТ БАЙГААГҮЙ
CREATE INDEX IF NOT EXISTS "Episode_streamStatus_streamStartedAt_idx"
  ON "Episode"("streamStatus", "streamStartedAt");
