-- PAGE → PAGE / PAGE → IG ДАМЖУУЛАЛТЫН БҮРТГЭЛ
--
-- ⚠️⚠️ `SocialCrosspost`-ООС ТУСДАА. Тэр нь `fbPostId @unique` тул нэг
-- постыг ЗӨВХӨН НЭГ зорилтот руу явуулж чадна. Энэ нь нэг постыг ОЛОН
-- зорилтот руу (2 page + 2 IG) явуулах шаардлагатай.
-- Ажиллаж байгаа crosspost-ыг эвдэхгүйн тулд шинэ хүснэгт.
CREATE TABLE "SocialRelay" (
    "id" TEXT NOT NULL,
    "sourcePostId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetName" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "externalId" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SocialRelay_pkey" PRIMARY KEY ("id")
);

-- ⚠️ ДАВХАРДЛЫН ХАМГААЛАЛТ — нэг пост нэг зорилтот руу ЗӨВХӨН НЭГ УДАА.
-- Админ хоёр таб нээгээд зэрэг дарвал хоёр дахь нь мөрийг ШИНЭЧИЛНЭ.
CREATE UNIQUE INDEX "SocialRelay_sourcePostId_targetId_key"
    ON "SocialRelay"("sourcePostId", "targetId");

CREATE INDEX "SocialRelay_status_createdAt_idx" ON "SocialRelay"("status", "createdAt");
CREATE INDEX "SocialRelay_sourceId_idx" ON "SocialRelay"("sourceId");
