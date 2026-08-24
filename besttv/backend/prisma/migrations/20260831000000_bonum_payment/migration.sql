-- Bonum Gateway төлбөр (карт · Apple Pay · Google Pay · WeChat)
-- ⚠️ QPay-ийн талбарууд ХЭВЭЭР — энэ нь зэрэгцээ ЗАМ, зөвхөн НЭМЭЛТ
--    багана (эрсдэлгүй migration, өгөгдөл алдагдахгүй).
ALTER TABLE "Payment" ADD COLUMN "bonumInvoiceId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "bonumFollowUpLink" TEXT;

-- ⚠️ @unique — webhook нь invoiceId-аар тааруулдаг тул давхардвал
--    нэг төлбөр хоёр удаа баталгаажих эрсдэлтэй (идемпотент баталгаа).
CREATE UNIQUE INDEX "Payment_bonumInvoiceId_key" ON "Payment"("bonumInvoiceId");
