-- АДМИНЫ ХАДГАЛСАН ИМЭЙЛИЙН ЗАГВАР
-- ⚠️ Броадкаст бүрд бичвэрээ ЭХНЭЭС нь бичих ёстой байсныг засна.
-- ⚠️ Гадаад холбоосгүй ЭНГИЙН контентын хүснэгт: устгахад юу ч тасрахгүй.
--    Илгээсэн имэйл нь HTML-ээ EmailLog-д ӨӨРӨӨ хадгалдаг тул загвар
--    устгасан ч илгээлтийн түүх бүрэн үлдэнэ.
CREATE TABLE "EmailTemplateSaved" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "heading" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "ctaText" TEXT,
    "ctaUrl" TEXT,
    -- ⚠️ Илгээгчийн НЭР (хаяг БИШ — тэр нь MAIL_FROM хэвээр).
    --    Шинэ хаяг нь SES баталгаажуулалт шаарддаг тул энд солихгүй.
    "senderName" TEXT,
    -- ⚠️ Сүүлд ашигласан огноо — админ идэвхтэй загварыг эхэнд харна
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplateSaved_pkey" PRIMARY KEY ("id")
);

-- Жагсаалтын эрэмбэ — сүүлд ашигласан нь дээр
CREATE INDEX "EmailTemplateSaved_lastUsedAt_idx" ON "EmailTemplateSaved"("lastUsedAt");
