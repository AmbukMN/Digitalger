-- ⚠️ ТУСДАА ажиллуулна (migration-ийн ДАРАА) — учир ALTER TYPE ADD VALUE хийсэн enum
-- утгыг ижил transaction-д ашиглах боломжгүй (Postgres хязгаар).
-- Одоогийн гол admin-ийг SUPERADMIN болгож, бүх одоо байгаа контентыг түүний эзэмшил болгоно.

-- 1) admin@digitalger.mn → SUPERADMIN
UPDATE "User" SET "role" = 'SUPERADMIN' WHERE "email" = 'admin@digitalger.mn';

-- 2) Эзэнгүй (createdByUserId IS NULL) контент бүрийг SUPERADMIN-руу backfill.
DO $$
DECLARE sa TEXT;
BEGIN
  SELECT "id" INTO sa FROM "User" WHERE "role" = 'SUPERADMIN' ORDER BY "createdAt" LIMIT 1;
  IF sa IS NOT NULL THEN
    UPDATE "Product"           SET "createdByUserId" = sa WHERE "createdByUserId" IS NULL;
    UPDATE "Category"          SET "createdByUserId" = sa WHERE "createdByUserId" IS NULL;
    UPDATE "ProductTypeConfig" SET "createdByUserId" = sa WHERE "createdByUserId" IS NULL;
    UPDATE "Testimonial"       SET "createdByUserId" = sa WHERE "createdByUserId" IS NULL;
    UPDATE "FAQ"               SET "createdByUserId" = sa WHERE "createdByUserId" IS NULL;
    UPDATE "BlogPost"          SET "createdByUserId" = sa WHERE "createdByUserId" IS NULL;
    UPDATE "Banner"            SET "createdByUserId" = sa WHERE "createdByUserId" IS NULL;
    UPDATE "Page"              SET "createdByUserId" = sa WHERE "createdByUserId" IS NULL;
    UPDATE "Coupon"            SET "createdByUserId" = sa WHERE "createdByUserId" IS NULL;
  END IF;
END $$;
