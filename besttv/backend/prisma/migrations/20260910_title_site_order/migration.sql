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
    -- ⚠️ NULL = hero баннерын тохиргоо; утгатай = тэр жанр доторх эрэмбэ
    "genreId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    -- ⚠️ ЗӨВХӨН genreId=NULL мөрд утгатай. NULL = Title.isBanner өвлөнө.
    "isBanner" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TitleSiteOrder_pkey" PRIMARY KEY ("id")
);

-- ⚠️⚠️ Кино×жанр×сайт бүрд НЭГ мөр.
--
-- ⚠️ Postgres-д `NULL` нь unique index дотор ДАВХАРДАЖ болдог тул
--    энгийн UNIQUE(titleId, genreId, site) нь hero мөрийг (genreId
--    NULL) давхардахаас ХАМГААЛАХГҮЙ. Тиймээс ХОЁР тусдаа index:
--      · genreId ҮНЭТЭЙ мөрд — ердийн unique
--      · genreId NULL мөрд    — partial unique (кино×сайт бүрд нэг)
CREATE UNIQUE INDEX "TitleSiteOrder_genre_key"
    ON "TitleSiteOrder"("titleId", "genreId", "site")
    WHERE "genreId" IS NOT NULL;

CREATE UNIQUE INDEX "TitleSiteOrder_hero_key"
    ON "TitleSiteOrder"("titleId", "site")
    WHERE "genreId" IS NULL;

-- ⚠️ Жанрын эгнээ татахад хамгийн их ашиглагдана
CREATE INDEX "TitleSiteOrder_site_genreId_order_idx"
    ON "TitleSiteOrder"("site", "genreId", "order");

-- ⚠️ Нүүрний hero carousel
CREATE INDEX "TitleSiteOrder_site_isBanner_order_idx"
    ON "TitleSiteOrder"("site", "isBanner", "order");

-- ⚠️ Кино эсвэл жанр устахад холбогдох мөр ч устана (CASCADE)
ALTER TABLE "TitleSiteOrder"
    ADD CONSTRAINT "TitleSiteOrder_titleId_fkey"
    FOREIGN KEY ("titleId") REFERENCES "Title"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TitleSiteOrder"
    ADD CONSTRAINT "TitleSiteOrder_genreId_fkey"
    FOREIGN KEY ("genreId") REFERENCES "Genre"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
