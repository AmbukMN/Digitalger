-- Видеон дээр BestTV лого шатаах эсэх
-- ⚠️ Анхдагч false — хуучин видеонууд хөндөгдөхгүй

ALTER TABLE "Title" ADD COLUMN "watermark" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Episode" ADD COLUMN "watermark" BOOLEAN NOT NULL DEFAULT false;
