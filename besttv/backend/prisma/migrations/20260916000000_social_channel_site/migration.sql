-- ⚠️⚠️ `SocialChannelSetting.channel` нь ГАНЦААРАА `@id` БАЙСАН
--
-- БОДИТ ЭРСДЭЛ (аудитаар илэрсэн): хоёр сайтад нийт 2 мөр л (FACEBOOK,
-- INSTAGRAM) багтана. BestFilm-ийн админ Facebook-ийг зогсоовол
-- `upsert({ where: { channel } })` нь BestTV-ийн мөрийг олж `paused`
-- болгодог — НЭГ САЙТЫН АДМИН НӨГӨӨГИЙНХӨӨ нийтлэлийг зогсооно.
--
-- Уншилтын тал ч эвдэрсэн: `findUnique` дээр өргөтгөл нь `where`-д
-- site нэмдэггүй тул өөр сайтын мөр олдвол `null` буцаж, pause
-- ЧИМЭЭГҮЙ үл тоомсорлогдоно.
--
-- ⚠️ Одоо байгаа мөрүүд БҮГД `site='besttv'` тул шинэ unique зөрчилгүй.

BEGIN;

-- Урьдчилан шалгах: (channel, site) давхардал байвал migration УНАНА
DO $$
DECLARE dup INT;
BEGIN
  SELECT count(*) INTO dup FROM (
    SELECT channel, site FROM "SocialChannelSetting" GROUP BY channel, site HAVING count(*) > 1
  ) x;
  IF dup > 0 THEN
    RAISE EXCEPTION '⛔ (channel, site) давхардал % — гараар засна уу', dup;
  END IF;
END $$;

-- 1. Хуучин primary key-г хасна
ALTER TABLE "SocialChannelSetting" DROP CONSTRAINT IF EXISTS "SocialChannelSetting_pkey";

-- 2. `id` багана нэмнэ (одоо байгаа мөрүүдэд утга онооно)
ALTER TABLE "SocialChannelSetting" ADD COLUMN IF NOT EXISTS "id" TEXT;
UPDATE "SocialChannelSetting"
   SET "id" = md5(random()::text || clock_timestamp()::text)
 WHERE "id" IS NULL;
ALTER TABLE "SocialChannelSetting" ALTER COLUMN "id" SET NOT NULL;

-- 3. Шинэ primary key
ALTER TABLE "SocialChannelSetting" ADD CONSTRAINT "SocialChannelSetting_pkey" PRIMARY KEY ("id");

-- 4. ⚠️ Сайт бүрд НЭГ мөр — энэ нь гол засвар
CREATE UNIQUE INDEX "SocialChannelSetting_channel_site_key"
    ON "SocialChannelSetting"("channel", "site");

COMMIT;
