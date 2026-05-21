-- AlterTable: add categoryIds array column to Product
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "categoryIds" TEXT[] NOT NULL DEFAULT '{}';
