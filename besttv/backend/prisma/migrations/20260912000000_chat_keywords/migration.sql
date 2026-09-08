-- ⚠️⚠️ ЧАТБОТЫН ТҮЛХҮҮР ҮГ + КИНОНЫ ХОЧ
--
-- БОДИТ ХЭРЭГЦЭЭ: хэрэглэгч чатад «99», «999» гэж бичихэд
-- «Өнчин охин» киног харуулах. Тэр үг гарчигт БАЙХГҮЙ.
--
-- ⚠️ Шинэ хүснэгт + нэг багана — БАЙГАА өгөгдөл хөндөгдөхгүй.
-- ⚠️ `lock_timeout` — production дээр аюулгүй.

SET lock_timeout = '3s';

-- ── 1. Киноны хайлтын хоч (Title.searchAliases) ──
ALTER TABLE "Title"
  ADD COLUMN IF NOT EXISTS "searchAliases" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- ── 2. Тааруулах төрөл ──
DO $$ BEGIN
  CREATE TYPE "ChatMatchType" AS ENUM ('EXACT', 'CONTAINS', 'PREFIX');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 3. Дүрмийн хүснэгт ──
CREATE TABLE IF NOT EXISTS "ChatKeyword" (
  "id"        TEXT NOT NULL,
  "keywords"  TEXT[],
  "matchType" "ChatMatchType" NOT NULL DEFAULT 'EXACT',
  "titleIds"  TEXT[],
  "reply"     TEXT,
  "note"      TEXT,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "order"     INTEGER NOT NULL DEFAULT 0,
  "hitCount"  INTEGER NOT NULL DEFAULT 0,
  "lastHitAt" TIMESTAMP(3),
  "site"      TEXT NOT NULL DEFAULT 'besttv',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatKeyword_pkey" PRIMARY KEY ("id")
);

-- ── 4. Индекс ──
-- ⚠️ CONCURRENTLY ХЭРЭГГҮЙ: хүснэгт ШИНЭ, мөр байхгүй тул түгжээ
--    хормын зуур. (Байгаа хүснэгтэд бол CONCURRENTLY заавал.)
CREATE INDEX IF NOT EXISTS "ChatKeyword_site_isActive_idx"
  ON "ChatKeyword" ("site", "isActive");
CREATE INDEX IF NOT EXISTS "ChatKeyword_site_order_idx"
  ON "ChatKeyword" ("site", "order");
-- ⚠️ GIN — массив доторх үгээр хайхад ЗААВАЛ (эс бөгөөс бүтэн скан)
CREATE INDEX IF NOT EXISTS "ChatKeyword_keywords_idx"
  ON "ChatKeyword" USING GIN ("keywords");
