-- Ангийн усан тэмдэг — ГУРВАН төлөвтэй болгов (null = кинооос өвлөнө).
--
-- ⚠️ Өмнө нь `Boolean NOT NULL DEFAULT false` байсан тул «тохируулаагүй»
-- болон «зориуд унтраасан» хоёр ялгагдахгүй байв. Логик нь OR (`анги ||
-- кино`) тул кинонд чагтлахад БҮХ ангид ХҮЧЭЭР ордог, нэг ангид хасах
-- боломжгүй байсан.
--
-- ⚠️ Одоо байгаа `false` утгууд БҮГД «тохируулаагүй» гэсэн утгатай
-- (админд UI байгаагүй тул хэн ч зориуд false болгож чадаагүй) —
-- тиймээс NULL болгож өвлөх төлөвт шилжүүлнэ. `true` байвал хэвээр.
ALTER TABLE "Episode" ALTER COLUMN "watermark" DROP DEFAULT;
ALTER TABLE "Episode" ALTER COLUMN "watermark" DROP NOT NULL;
UPDATE "Episode" SET "watermark" = NULL WHERE "watermark" = false;
