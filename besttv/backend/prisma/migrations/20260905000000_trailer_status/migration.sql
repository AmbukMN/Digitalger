-- ⚠️⚠️ ТРЕЙЛЕРИЙН ХӨРВҮҮЛЭЛТИЙН ТӨЛӨВ — `streamStatus`-ЭЭС ТУСДАА.
--
-- `streamStatus` нь КИНОНЫ видеонд харьяалагдана. Трейлерээр дарж
-- бичвэл бэлэн кино «хөрвүүлж байна» болж, үзэгч тоглуулж чадахгүй
-- болно. Тиймээс трейлер өөрийн талбартай байх ёстой.
--
-- Үүнгүй үед админ трейлер байршуулаад явцыг ОГТ харах боломжгүй байв.
ALTER TABLE "Title" ADD COLUMN "trailerStatus" "StreamStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Title" ADD COLUMN "trailerProgress" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Title" ADD COLUMN "trailerError" TEXT;
ALTER TABLE "Title" ADD COLUMN "trailerFileName" TEXT;

-- ⚠️ ОДОО БАЙГАА трейлерүүдийг БЭЛЭН гэж тэмдэглэнэ — эс бөгөөс
--    аль хэдийн ажиллаж байгаа трейлер админд «оруулаагүй» харагдана.
UPDATE "Title" SET "trailerStatus" = 'READY', "trailerProgress" = 100
WHERE "trailerKey" IS NOT NULL;
