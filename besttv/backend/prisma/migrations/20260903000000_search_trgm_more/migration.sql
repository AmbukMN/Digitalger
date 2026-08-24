-- ХАЙЛТЫН GIN TRIGRAM ИНДЕКС — дутуу 3 талбар
--
-- ⚠️ `titles.service.ts`-ийн `search()` нь үг бүрд 8 `contains` OR үүсгэдэг.
--    `title`/`titleEn`/`slug`-д GIN trgm индекс АЛЬ ХЭДИЙН бий, харин
--    `description`/`country`/`director` нь БҮТЭН SEQ SCAN хийж байв.
--    151 кинотой бол мэдрэгдэхгүй ч 5000 болоход CPU идэж эхэлнэ.
--
-- ⚠️ CONCURRENTLY ХЭРЭГЛЭХГҮЙ: Prisma migration нь transaction дотор
--    ажилладаг бөгөөс CONCURRENTLY тэнд ажиллах БОЛОМЖГҮЙ.
--    Хүснэгт жижиг (151 мөр) тул түгжээ хормын төдий.
CREATE INDEX IF NOT EXISTS "Title_description_trgm_idx"
  ON "Title" USING gin ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Title_country_trgm_idx"
  ON "Title" USING gin ("country" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Title_director_trgm_idx"
  ON "Title" USING gin ("director" gin_trgm_ops);
