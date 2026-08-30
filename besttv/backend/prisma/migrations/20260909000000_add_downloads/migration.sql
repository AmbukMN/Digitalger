-- ГАР УТСАНД ОФЛАЙН ТАТСАН КОНТЕНТ
-- ⚠️ DRM байхгүй тул ЭРХИЙГ мөрдөнө: апп нээгдэх бүрд /downloads/check
--    дуудаж, багцаа цуцалсан хэрэглэгчийн локал файлыг устгана.
CREATE TABLE "Download" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "quality" TEXT NOT NULL DEFAULT 'v2',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Download_pkey" PRIMARY KEY ("id")
);

-- ⚠️ Нэг анги нэг л удаа — дахин татахад upsert
CREATE UNIQUE INDEX "Download_userId_target_targetId_key"
    ON "Download"("userId", "target", "targetId");

-- Жагсаалт + heartbeat-ын гол query
CREATE INDEX "Download_userId_expiresAt_idx" ON "Download"("userId", "expiresAt");

ALTER TABLE "Download" ADD CONSTRAINT "Download_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Download" ADD CONSTRAINT "Download_titleId_fkey"
    FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;
