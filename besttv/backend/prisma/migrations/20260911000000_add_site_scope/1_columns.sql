-- ⚠️⚠️ BESTFILM MIGRATION — 1/3 · БАГАНА НЭМЭХ
--
-- Түгжээ: ACCESS EXCLUSIVE, гэхдээ ~миллисекунд.
-- PostgreSQL 11+ дээр DEFAULT-тай багана нэмэхэд хүснэгт ДАХИН
-- БИЧИГДДЭГГҮЙ — 366K мөртэй TitleEvent ч агшин зуур дуусна.
--
-- ⚠️ lock_timeout — түгжээ 3 секундэд авч чадаагүй бол ЗОГСОНО.
--    Үүнгүйгээр урт transaction ажиллаж байвал migration хүлээж,
--    ард нь БҮХ бичилт хуримтлагдаж сайт унана.
--
-- ⚠️ IF NOT EXISTS — дахин ажиллуулахад аюулгүй (idempotent).
--    Мөн production-д аль хэдийн байгаа багануудтай мөргөлдөхгүй.

SET lock_timeout = '3s';
SET statement_timeout = '60s';

BEGIN;

-- ──────────────────────────────────────────────────────────────────
-- site багана — 49 хүснэгт
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE "AdminSeen" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "BankAccount" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "DeviceToken" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "Download" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "EmailLog" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "EmailOpen" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "EmailOtp" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "EmailSuppression" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "EmailTemplateOverride" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "EmailTemplateSaved" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "ErrorLog" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "Faq" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "HomeBanner" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "MyListItem" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "PageView" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "PasswordResetToken" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "PhoneVerifySession" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "PlanGenre" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "PromotionPlan" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "PromotionRedemption" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "Rental" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "ReviewReport" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "ReviewVote" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "SavedCard" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "SearchEvent" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "SocialChannelSetting" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "SocialCrosspost" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "SocialPost" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "SocialPostTarget" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "SocialRelay" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "SocialSlot" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "Subscriber" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "TitleEvent" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "UserAuditLog" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "UserSession" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "WalletTransaction" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "WatchProgress" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';
ALTER TABLE "ChatConversation" ADD COLUMN IF NOT EXISTS "site" TEXT NOT NULL DEFAULT 'besttv';

-- ──────────────────────────────────────────────────────────────────
-- Title.sites — олон сайтад харагдана
-- ──────────────────────────────────────────────────────────────────

-- ⚠️ Массив: кино нь ХОЁУЛАНД харагдаж болно (нэг удаа upload)
ALTER TABLE "Title" ADD COLUMN IF NOT EXISTS "sites" TEXT[] DEFAULT ARRAY['besttv']::TEXT[];

-- ⚠️ ОДООГИЙН 257 КИНО БҮГД ХОЁР САЙТАД — таны шийдвэрээр каталог ижил.
--    Энэ нь UPDATE тул хэдэн зуун мөрд л ажиллана (хурдан).
UPDATE "Title" SET "sites" = ARRAY['besttv','bestfilm']::TEXT[]
 WHERE "sites" = ARRAY['besttv']::TEXT[] OR "sites" IS NULL;

COMMIT;

-- ⚠️ ШАЛГАХ: бүх хүснэгтэд site орсон эсэх
-- SELECT table_name FROM information_schema.columns
--  WHERE column_name='site' AND table_schema='public' ORDER BY 1;
