-- CreateTable (IF NOT EXISTS — dump-с restore хийсэн үед аль хэдийн байж болно)
CREATE TABLE IF NOT EXISTS "ImageVariant" (
    "id" TEXT NOT NULL,
    "productImageId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/webp',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ImageVariant_productImageId_idx" ON "ImageVariant"("productImageId");

-- AddForeignKey (зөвхөн байхгүй бол нэмнэ)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ImageVariant_productImageId_fkey'
  ) THEN
    ALTER TABLE "ImageVariant" ADD CONSTRAINT "ImageVariant_productImageId_fkey"
      FOREIGN KEY ("productImageId") REFERENCES "ProductImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
