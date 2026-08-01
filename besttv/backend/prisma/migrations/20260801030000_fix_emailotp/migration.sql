-- ⚠️ `prisma format` алдаатай нэмсэн titleId багана — EmailOtp нь Title-тай
-- ХАМААРАЛГҮЙ. Migration үүсгэхээс өмнө format хийсэн тул орсон.
ALTER TABLE "EmailOtp" DROP COLUMN IF EXISTS "titleId";
