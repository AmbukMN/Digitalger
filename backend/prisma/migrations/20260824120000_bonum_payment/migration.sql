-- Bonum төлбөр (карт/WeChat hosted checkout) — QPay-тэй зэрэгцээ
ALTER TABLE "Payment" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'qpay';
ALTER TABLE "Payment" ADD COLUMN "bonumInvoiceId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "bonumFollowUpLink" TEXT;
CREATE UNIQUE INDEX "Payment_bonumInvoiceId_key" ON "Payment"("bonumInvoiceId");
