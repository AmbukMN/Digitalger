-- ⚠️⚠️ BESTFILM MIGRATION — 3/3 · ХУУЧИН UNIQUE ХААХ
--
-- ⚠️⚠️ ЗӨВХӨН ШИНЭ КОДЫГ DEPLOY ХИЙЖ, САЙТ ХЭВИЙН АЖИЛЛАЖ
--    БАЙГААГ БАТАЛСНЫ ДАРАА ажиллуул!
--
-- ЯАГААД ЭНЭ ДАРААЛАЛ ВЭ:
--   · Хуучин код `findUnique({where:{email}})` дуудна → хуучин
--     индекс хэрэгтэй
--   · Шинэ код `findFirst` / `{email_site:{...}}` дуудна → шинэ
--     индекс хэрэгтэй
--   · Хоёуланг ЗЭРЭГ байлгаснаар deploy-ийн үед аль ч хувилбар
--     ажиллана (zero-downtime)
--
-- ⚠️ Эдгээрийг хаяхаас ӨМНӨ ШИНЭ unique-үүд VALID эсэхийг шалга
--    (2_indexes.sql-ийн төгсгөл).
--
-- ⚠️ CONCURRENTLY — түгжээ бага. Транзакцаас ГАДНА.

DROP INDEX CONCURRENTLY IF EXISTS "Coupon_code_key";
DROP INDEX CONCURRENTLY IF EXISTS "EmailSuppression_email_key";
DROP INDEX CONCURRENTLY IF EXISTS "Page_slug_key";
DROP INDEX CONCURRENTLY IF EXISTS "Subscriber_email_key";
DROP INDEX CONCURRENTLY IF EXISTS "User_appleId_key";
DROP INDEX CONCURRENTLY IF EXISTS "User_email_key";
DROP INDEX CONCURRENTLY IF EXISTS "User_facebookId_key";
DROP INDEX CONCURRENTLY IF EXISTS "User_googleId_key";
DROP INDEX CONCURRENTLY IF EXISTS "User_phone_key";

-- ⚠️ БУЦААХ (rollback) — хэрэв шинэ код унавал:
-- CREATE UNIQUE INDEX CONCURRENTLY "User_email_key" ON "User"("email");
-- ⚠️ Гэхдээ энэ нь ЗӨВХӨН bestfilm-д хэрэглэгч бүртгэгдээгүй үед
--    амжилттай болно (давхардсан имэйл байвал унана).
