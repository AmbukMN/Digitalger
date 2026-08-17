-- ХАЙЛТЫН TRIGRAM — алдаатай бичилтийг тэсвэрлэх
--
-- ⚠️⚠️ ЯАГААД: `contains` нь ЯГ таарсан дэд мөрийг л олдог тул
-- «үлтаних» (зай орхисон), «танихох» (үсэг дутуу), «дангин» (нөхцөл
-- буруу) гэх мэт хүний энгийн алдааг ОГТ таньдаггүй. Хэрэглэгч
-- «олдсонгүй» гэсэн хариу авч, кино байсаар атал орхиод явна.
--
-- pg_trgm нь мөрийг 3 үсгийн бүлэг болгон задалж, давхцлын хувиар
-- ойролцоо байдлыг хэмжинэ. «үлтаних» ↔ «үл таних охин» нь trigram
-- ихээхэн давхцана.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ⚠️ GIN индекс — 146 мөр дээр seq scan ч болно, гэхдээ каталог
-- өсөхөд (1000+) индексгүй бол хайлт бүрд бүтэн скан хийнэ.
-- `gin_trgm_ops` нь `%` (similarity) болон `ILIKE`-ыг хоёуланг хурдасгана.
CREATE INDEX IF NOT EXISTS "Title_title_trgm_idx"
  ON "Title" USING gin ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Title_titleEn_trgm_idx"
  ON "Title" USING gin ("titleEn" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Title_slug_trgm_idx"
  ON "Title" USING gin ("slug" gin_trgm_ops);
