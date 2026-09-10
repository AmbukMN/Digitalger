-- ═══════════════════════════════════════════════════════════════════
-- КИНОНЫ ХАРАГДАЦ САЙТ БҮРД — `TitleSiteOrder`
--
-- ⚠️⚠️ ЗӨВХӨН ШИНЭ ХООСОН ХҮСНЭГТ ҮҮСГЭНЭ.
--    Байгаа `Title`, `TitleGenre` мөрүүд ОГТ хөндөгдөхгүй —
--    258 кино, 259 жанрын холбоос бүрэн бүтэн үлдэнэ.
--
-- ⚠️ Мөр байхгүй үед `Title`-ийн үндсэн утга (fallback) хэрэглэгдэнэ
--    тул урьдчилж дата нөхөх шаардлагагүй. Админ нэг сайт дээр
--    эрэмбэ өөрчилсөн үед л мөр үүснэ (`GenreSiteOrder`-той ижил).
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE "TitleSiteOrder" (
    "id" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    /**
     * ⚠️⚠️ `''` (ХООСОН МӨР) = hero баннерын тохиргоо.
     *      Утгатай = тэр жанр доторх эрэмбэ.
     *
     * ⛔ ЯАГААД NULL БИШ ВЭ: Prisma `upsert` нь
     *    `ON CONFLICT (titleId, genreId, site)` үүсгэдэг. NULL-тай
     *    баганад PARTIAL unique index (`WHERE genreId IS NOT NULL`)
     *    тавих шаардлагатай ба тэр нь ON CONFLICT-той ТААРДАГГҮЙ
     *    → Postgres 42P10 (бодит алдаа, 2026-09-10).
     *
     * ⚠️ `''` нь `Genre.id`-д ХЭЗЭЭ Ч тохиолдохгүй (cuid = 25 тэмдэгт).
     * ⚠️ Genre руу FK ТАВИХГҮЙ — hero мөр жанртай холбогдохгүй.
     */
    "genreId" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    -- ⚠️ ЗӨВХӨН genreId='' мөрд утгатай. NULL = Title.isBanner өвлөнө.
    "isBanner" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TitleSiteOrder_pkey" PRIMARY KEY ("id")
);

-- ⚠️⚠️ БҮТЭН unique — Prisma `upsert`-ийн ON CONFLICT энэтэй таарна.
--    (PARTIAL index байсан үед 42P10 алдаа гарч байсан.)
ALTER TABLE "TitleSiteOrder"
    ADD CONSTRAINT "TitleSiteOrder_titleId_genreId_site_key"
    UNIQUE ("titleId", "genreId", "site");

-- ⚠️ Жанрын эгнээ татахад хамгийн их ашиглагдана
CREATE INDEX "TitleSiteOrder_site_genreId_order_idx"
    ON "TitleSiteOrder"("site", "genreId", "order");

-- ⚠️ Нүүрний hero carousel (`genreId = ''` мөрүүд)
CREATE INDEX "TitleSiteOrder_site_isBanner_order_idx"
    ON "TitleSiteOrder"("site", "isBanner", "order");

-- ⚠️ Кино устахад холбогдох мөр ч устана (CASCADE)
ALTER TABLE "TitleSiteOrder"
    ADD CONSTRAINT "TitleSiteOrder_titleId_fkey"
    FOREIGN KEY ("titleId") REFERENCES "Title"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
