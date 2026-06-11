-- Multi-tenant: Role enum өргөтгөл (EDITOR/SUPERADMIN) + контентод ownership (createdByUserId).
-- ⚠️ Postgres-д ALTER TYPE ADD VALUE нь transaction block дотор ажиллахгүй тул Prisma
-- автоматаар тусдаа statement болгон ажиллуулна. NULLABLE column тул байгаа дата унахгүй.

-- 1) Role enum-д шинэ утга нэмэх (USER/ADMIN аль хэдийн бий).
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'EDITOR';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPERADMIN';

-- 2) Контент model-уудад createdByUserId (nullable) + FK (SetNull) нэмэх.
ALTER TABLE "Product" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "Category" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "ProductTypeConfig" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "Testimonial" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "FAQ" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "Banner" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "Page" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "Coupon" ADD COLUMN "createdByUserId" TEXT;

-- 3) Index (createdByUserId-аар scoping query хурдан).
CREATE INDEX "Product_createdByUserId_idx" ON "Product"("createdByUserId");
CREATE INDEX "Category_createdByUserId_idx" ON "Category"("createdByUserId");
CREATE INDEX "ProductTypeConfig_createdByUserId_idx" ON "ProductTypeConfig"("createdByUserId");
CREATE INDEX "Testimonial_createdByUserId_idx" ON "Testimonial"("createdByUserId");
CREATE INDEX "FAQ_createdByUserId_idx" ON "FAQ"("createdByUserId");
CREATE INDEX "BlogPost_createdByUserId_idx" ON "BlogPost"("createdByUserId");
CREATE INDEX "Banner_createdByUserId_idx" ON "Banner"("createdByUserId");
CREATE INDEX "Page_createdByUserId_idx" ON "Page"("createdByUserId");
CREATE INDEX "Coupon_createdByUserId_idx" ON "Coupon"("createdByUserId");

-- 4) FK constraint (User устгахад контент null болно — контент устахгүй).
ALTER TABLE "Product" ADD CONSTRAINT "Product_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductTypeConfig" ADD CONSTRAINT "ProductTypeConfig_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Testimonial" ADD CONSTRAINT "Testimonial_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FAQ" ADD CONSTRAINT "FAQ_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Page" ADD CONSTRAINT "Page_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
