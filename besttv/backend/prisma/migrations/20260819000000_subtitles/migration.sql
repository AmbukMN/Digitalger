-- Хадмал (soft sub) — тусдаа .vtt файл, олон хэл

CREATE TABLE "Subtitle" (
    "id" TEXT NOT NULL,
    "titleId" TEXT,
    "episodeId" TEXT,
    "lang" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subtitle_pkey" PRIMARY KEY ("id")
);

-- ⚠️ Нэг видеонд нэг хэл ДАВХАРДАХГҮЙ
CREATE UNIQUE INDEX "Subtitle_titleId_lang_key" ON "Subtitle"("titleId", "lang");
CREATE UNIQUE INDEX "Subtitle_episodeId_lang_key" ON "Subtitle"("episodeId", "lang");
CREATE INDEX "Subtitle_titleId_idx" ON "Subtitle"("titleId");
CREATE INDEX "Subtitle_episodeId_idx" ON "Subtitle"("episodeId");

ALTER TABLE "Subtitle" ADD CONSTRAINT "Subtitle_titleId_fkey"
  FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subtitle" ADD CONSTRAINT "Subtitle_episodeId_fkey"
  FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
