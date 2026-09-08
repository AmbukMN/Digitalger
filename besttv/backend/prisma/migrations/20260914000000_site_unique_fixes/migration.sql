-- ⚠️⚠️ САЙТ ОРООГҮЙ UNIQUE-УУДЫГ ЗАСНА
--
-- БОДИТ АЛДАА (2026-09-08): `AdminSeen` нь `[adminId, section]`-ээр
-- unique байсан тул BestFilm дээр хэсэг рүү орж badge цэвэрлэхэд
-- `upsert` нь BestTV-ийн мөрийг олж шинэчилдэг байв. Үр дүнд
-- BestFilm-ийн badge ХЭЗЭЭ Ч арилахгүй, BestTV-ийнх буруу арилдаг.
--
-- Мөн `EmailTemplateOverride.campaign`, `SocialSlot` нь сайт бүрд
-- өөр утга авах боломжгүй байв.
--
-- ⚠️ Одоо байгаа мөрүүд бүгд `site='besttv'` тул шинэ unique
--    зөрчил ҮҮСГЭХГҮЙ (шалгалт доор).

BEGIN;

-- ── 1. AdminSeen ────────────────────────────────────────────────
ALTER TABLE "AdminSeen" DROP CONSTRAINT IF EXISTS "AdminSeen_adminId_section_key";
DROP INDEX IF EXISTS "AdminSeen_adminId_section_key";
CREATE UNIQUE INDEX "AdminSeen_adminId_section_site_key"
    ON "AdminSeen"("adminId", "section", "site");

-- ── 2. EmailTemplateOverride ────────────────────────────────────
ALTER TABLE "EmailTemplateOverride" DROP CONSTRAINT IF EXISTS "EmailTemplateOverride_campaign_key";
DROP INDEX IF EXISTS "EmailTemplateOverride_campaign_key";
CREATE UNIQUE INDEX "EmailTemplateOverride_campaign_site_key"
    ON "EmailTemplateOverride"("campaign", "site");

-- ── 3. SocialSlot ───────────────────────────────────────────────
ALTER TABLE "SocialSlot" DROP CONSTRAINT IF EXISTS "SocialSlot_channel_weekday_time_key";
DROP INDEX IF EXISTS "SocialSlot_channel_weekday_time_key";
CREATE UNIQUE INDEX "SocialSlot_channel_weekday_time_site_key"
    ON "SocialSlot"("channel", "weekday", "time", "site");

COMMIT;
