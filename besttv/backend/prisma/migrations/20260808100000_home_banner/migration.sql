-- ⚠️ НҮҮРНИЙ ДУНД БАННЕР — `Title.isBanner` (hero carousel)-ЭЭС ТУСДАА.
-- Тэр нь кинонд холбогдсон дээд талын carousel. Энэ нь жанрын эгнээнүүдийн
-- ДУНД орох бие даасан зурвас — кино биш ямар ч зүйл сурталчилж болно
-- (багц, урамшуулал, гадаад холбоос).
CREATE TABLE "HomeBanner" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "subtitle" TEXT NOT NULL DEFAULT '',
    "imageKey" TEXT NOT NULL,
    -- ⚠️ Мобайлд өөр зураг — өргөн 16:9 нь утсан дээр хэт нарийн харагдана
    "mobileImageKey" TEXT,
    "ctaText" TEXT NOT NULL DEFAULT '',
    "ctaHref" TEXT NOT NULL DEFAULT '',
    -- Хэддэх жанрын эгнээний ДАРАА орох (0 = хамгийн дээр)
    "position" INTEGER NOT NULL DEFAULT 2,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    -- ⚠️ Хугацаат урамшуулалд — NULL бол хязгааргүй
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeBanner_pkey" PRIMARY KEY ("id")
);

-- Нүүрний асуулгад: идэвхтэй → байрлал → эрэмбэ
CREATE INDEX "HomeBanner_isActive_position_order_idx"
  ON "HomeBanner"("isActive", "position", "order");
