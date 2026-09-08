-- Жанрын САЙТ БҮРИЙН эрэмбэ ба харагдац
--
-- ⚠️ `Genre` өөрөө SHARED хэвээр (160+ киноны холбоос давхарлахгүй).
-- ⚠️ Мөр байхгүй жанр нь `Genre.order`-оор эрэмбэлэгдэж ХАРАГДАНА —
--    BestTV-ийн одоогийн зан төлөв ЯГ ХЭВЭЭР үлдэнэ (шинэ хүснэгт
--    хоосон эхэлнэ).

CREATE TABLE "GenreSiteOrder" (
    "id"        TEXT NOT NULL,
    "genreId"   TEXT NOT NULL,
    "site"      TEXT NOT NULL,
    "order"     INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenreSiteOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GenreSiteOrder_genreId_site_key"
    ON "GenreSiteOrder"("genreId", "site");

CREATE INDEX "GenreSiteOrder_site_order_idx"
    ON "GenreSiteOrder"("site", "order");

-- ⚠️ Жанр устгавал эрэмбийн мөр ч устана (өнчин мөр үлдэхгүй)
ALTER TABLE "GenreSiteOrder"
    ADD CONSTRAINT "GenreSiteOrder_genreId_fkey"
    FOREIGN KEY ("genreId") REFERENCES "Genre"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
