-- ⚠️ ШИРХЭГЭЭР ТҮРЭЭСЛЭХ QPay төлбөр.
-- Өмнө нь түрээслэх ЦОРЫН ГАНЦ зам нь хэтэвч байсан тул хэтэвчгүй
-- хэрэглэгч 2 алхамт урсгалд ордог байв (эхлээд цэнэглэ → дараа нь түрээсэл).

-- `Payment.rentalTitleId` — энэ талбар байвал `planId` NULL байна.
-- ⚠️ `ON DELETE SET NULL` — кино устсан ч ТӨЛБӨРИЙН ТҮҮХ үлдэх ёстой
-- (санхүүгийн бүртгэл; CASCADE бол мөнгөний мөр алга болно).
ALTER TABLE "Payment" ADD COLUMN "rentalTitleId" TEXT;
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_rentalTitleId_fkey"
  FOREIGN KEY ("rentalTitleId") REFERENCES "Title"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Payment_rentalTitleId_idx" ON "Payment"("rentalTitleId");

-- ⚠️⚠️ `Rental.paymentId` дээр UNIQUE — нэг төлбөр ЗӨВХӨН нэг түрээс.
-- QPay callback + polling + reconcile ГУРВУУЛАА ижил төлбөрийг
-- баталгаажуулж болох тул давхар Rental үүсэхээс DB түвшинд хамгаална.
-- ⚠️ NULL утгууд хоорондоо давхцахад Postgres UNIQUE-д саад болохгүй
-- (хэтэвчээр түрээсэлсэн хуучин мөрүүд бүгд NULL).
CREATE UNIQUE INDEX "Rental_paymentId_key" ON "Rental"("paymentId");
ALTER TABLE "Rental"
  ADD CONSTRAINT "Rental_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ⚠️ ЭРЭМБЭЛЭЛТИЙН ИНДЕКСҮҮД — эдгээргүй үед Postgres БҮТЭН СКАН + sort.
-- `views`/`createdAt`/`rating` нь orderBy-д байнга хэрэглэгддэг мөртлөө
-- индексгүй байв. `isActive` эхэнд — бүх асуулга түүгээр шүүдэг.
CREATE INDEX "Title_isActive_createdAt_idx" ON "Title"("isActive", "createdAt");
CREATE INDEX "Title_isActive_comingSoon_views_idx" ON "Title"("isActive", "comingSoon", "views");
CREATE INDEX "Title_isActive_rating_idx" ON "Title"("isActive", "rating");
