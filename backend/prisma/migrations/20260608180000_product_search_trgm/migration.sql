-- Trigram (pg_trgm) GIN индексүүд: ILIKE / contains хайлтыг (sequential scan →
-- index scan) эрс хурдасгана. Код өөрчлөхгүй — Prisma-ийн одоогийн
-- { contains, mode: 'insensitive' } query-г PostgreSQL planner шууд ашиглана.
--
-- pg_trgm extension нь 20260530000000_enable_pg_trgm migration-д аль хэдийн
-- идэвхжсэн. Энд зөвхөн GIN индексүүдийг нэмнэ (raw SQL — Prisma datamodel-д
-- илэрхийлэхгүй, migrate deploy ажиллана).
--
-- ⚠️ CONCURRENTLY ашиглаагүй: Prisma migration нь transaction дотор ажилладаг,
-- CREATE INDEX CONCURRENTLY transaction дотор зөвшөөрөгддөггүй. Хүснэгт жижиг
-- (500-1000 мөр) тул энгийн CREATE INDEX-ийн lock богино хугацаанд л үргэлжилнэ.

-- Product: гол хайлтын талбарууд (search() OR-ийн дийлэнх энд тулдаг)
CREATE INDEX IF NOT EXISTS "Product_title_trgm_idx"
  ON "Product" USING gin ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Product_description_trgm_idx"
  ON "Product" USING gin ("description" gin_trgm_ops);

-- whatsIncluded / howToUse / seoTitle nullable — NULL мөрийг индекс алгасна
CREATE INDEX IF NOT EXISTS "Product_whatsIncluded_trgm_idx"
  ON "Product" USING gin ("whatsIncluded" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Product_seoTitle_trgm_idx"
  ON "Product" USING gin ("seoTitle" gin_trgm_ops);

-- Category нэрээр хайх (search() category.name contains) хурдасгана
CREATE INDEX IF NOT EXISTS "Category_name_trgm_idx"
  ON "Category" USING gin ("name" gin_trgm_ops);
