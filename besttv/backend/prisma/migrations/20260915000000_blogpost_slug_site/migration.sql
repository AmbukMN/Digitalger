-- ⚠️⚠️ `BlogPost.slug` — ГЛОБАЛ unique → САЙТЫН ХҮРЭЭНД unique
--
-- БОДИТ АЛДАА (2026-09-08): BestTV-ийн блогийг BestFilm рүү хуулах
-- үед `P2002 Unique constraint failed on (slug)` гарав. Хоёр сайт
-- ижил нийтлэлтэй байх боломжгүй байсан.
--
-- ⚠️ `20260911000000_add_site_scope` нь User/Coupon/Page гэх мэтийг
--    хамарсан ч `BlogPost`-ыг АЛГАССАН байв.
--
-- ⚠️ Одоо байгаа бүх мөр `site='besttv'` тул шинэ unique зөрчилгүй
--    (доорх шалгалт хоосон буцаах ёстой).

BEGIN;

-- Урьдчилан шалгах: ижил (slug, site) хос байвал migration УНАНА
DO $$
DECLARE dup INT;
BEGIN
  SELECT count(*) INTO dup FROM (
    SELECT slug, site FROM "BlogPost" GROUP BY slug, site HAVING count(*) > 1
  ) x;
  IF dup > 0 THEN
    RAISE EXCEPTION '⛔ (slug, site) давхардал % — гараар засна уу', dup;
  END IF;
END $$;

ALTER TABLE "BlogPost" DROP CONSTRAINT IF EXISTS "BlogPost_slug_key";
DROP INDEX IF EXISTS "BlogPost_slug_key";

CREATE UNIQUE INDEX "BlogPost_slug_site_key" ON "BlogPost"("slug", "site");

COMMIT;
