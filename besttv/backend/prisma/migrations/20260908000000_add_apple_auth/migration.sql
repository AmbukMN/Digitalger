-- APPLE SIGN-IN
-- ⚠️ App Store-ийн Guideline 4.8: Google/Facebook нэвтрэлт байвал
--    Apple Sign-In ЗААВАЛ байх ёстой, эс бөгөөс аппыг татгалзана.
--
-- ⚠️⚠️ `ALTER TYPE ... ADD VALUE` нь PostgreSQL-д ТРАНЗАКЦ ДОТОР
--    ажиллахгүй (Postgres 12+ дээр ажилладаг ч Prisma нь бүх migration-ыг
--    транзакцаар боодог). Тиймээс ТУСАД нь, эхний мэдэгдэл болгож бичив.
--    Алдаа гарвал `ALTER TYPE`-ыг гараар ажиллуулж, дараа нь энэ файлыг
--    `prisma migrate resolve --applied` гэж тэмдэглэнэ.
ALTER TYPE "AuthProvider" ADD VALUE IF NOT EXISTS 'APPLE';

-- ⚠️ Apple-ийн `sub` нь ХЭРЭГЛЭГЧ×АПП тус бүрд өөр (Google/FB шиг
--    глобал биш). Bundle ID солибол бүх хэрэглэгч шинэ ID авна.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "appleId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_appleId_key" ON "User"("appleId");
