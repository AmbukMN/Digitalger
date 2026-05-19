/*
  Warnings:

  - You are about to drop the column `productId` on the `FAQ` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `FAQ` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "FAQ" DROP CONSTRAINT "FAQ_productId_fkey";

-- DropIndex
DROP INDEX "FAQ_productId_sortOrder_idx";

-- AlterTable
ALTER TABLE "FAQ" DROP COLUMN "productId",
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "compareAtPrice" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "ProductFAQ" (
    "productId" TEXT NOT NULL,
    "faqId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductFAQ_pkey" PRIMARY KEY ("productId","faqId")
);

-- CreateTable
CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "role" TEXT,
    "content" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "featured" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductTestimonial" (
    "productId" TEXT NOT NULL,
    "testimonialId" TEXT NOT NULL,

    CONSTRAINT "ProductTestimonial_pkey" PRIMARY KEY ("productId","testimonialId")
);

-- CreateTable
CREATE TABLE "ProductBundle" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleItem" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fileId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BundleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Testimonial_active_featured_sortOrder_idx" ON "Testimonial"("active", "featured", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductBundle_productId_sortOrder_idx" ON "ProductBundle"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "BundleItem_bundleId_sortOrder_idx" ON "BundleItem"("bundleId", "sortOrder");

-- CreateIndex
CREATE INDEX "FAQ_active_sortOrder_idx" ON "FAQ"("active", "sortOrder");

-- AddForeignKey
ALTER TABLE "ProductFAQ" ADD CONSTRAINT "ProductFAQ_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFAQ" ADD CONSTRAINT "ProductFAQ_faqId_fkey" FOREIGN KEY ("faqId") REFERENCES "FAQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTestimonial" ADD CONSTRAINT "ProductTestimonial_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTestimonial" ADD CONSTRAINT "ProductTestimonial_testimonialId_fkey" FOREIGN KEY ("testimonialId") REFERENCES "Testimonial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBundle" ADD CONSTRAINT "ProductBundle_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleItem" ADD CONSTRAINT "BundleItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "ProductBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
