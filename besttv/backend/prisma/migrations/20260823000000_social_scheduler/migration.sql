-- Нийгмийн сүлжээний нийтлэл товлогч (FB + IG).
--
-- ⚠️ `SocialCrosspost`-ыг ХӨНДӨХГҮЙ — тэр нь FB→IG хуулбарлагч,
-- одоо ажиллаж байгаа. Энэ нь ШИНЭЭР пост зохиох тусдаа систем.

CREATE TYPE "SocialChannel" AS ENUM ('FACEBOOK', 'INSTAGRAM');

CREATE TYPE "SocialPostStatus" AS ENUM (
  'DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'PARTIAL', 'FAILED', 'CANCELLED'
);

CREATE TYPE "SocialTargetStatus" AS ENUM (
  'PENDING', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'SKIPPED'
);

CREATE TABLE "SocialPost" (
  "id"          TEXT NOT NULL,
  "status"      "SocialPostStatus" NOT NULL DEFAULT 'DRAFT',
  "body"        TEXT NOT NULL DEFAULT '',
  "mediaKeys"   TEXT[],
  "scheduledAt" TIMESTAMP(3),
  "titleId"     TEXT,
  "recycle"     JSONB,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- ⚠️ Cron-ий гол query — индексгүй бол минут тутам бүтэн скан
CREATE INDEX "SocialPost_status_scheduledAt_idx" ON "SocialPost"("status", "scheduledAt");
CREATE INDEX "SocialPost_createdAt_idx" ON "SocialPost"("createdAt");

CREATE TABLE "SocialPostTarget" (
  "id"             TEXT NOT NULL,
  "postId"         TEXT NOT NULL,
  "channel"        "SocialChannel" NOT NULL,
  "status"         "SocialTargetStatus" NOT NULL DEFAULT 'PENDING',
  "caption"        TEXT,
  "externalId"     TEXT,
  "error"          TEXT,
  "attempts"       INTEGER NOT NULL DEFAULT 0,
  "publishedAt"    TIMESTAMP(3),
  "idempotencyKey" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialPostTarget_pkey" PRIMARY KEY ("id")
);

-- ⚠️ Retry үед давхар нийтлэхээс сэргийлнэ
CREATE UNIQUE INDEX "SocialPostTarget_idempotencyKey_key"
  ON "SocialPostTarget"("idempotencyKey");
-- Нэг постод нэг суваг ЗӨВХӨН НЭГ УДАА
CREATE UNIQUE INDEX "SocialPostTarget_postId_channel_key"
  ON "SocialPostTarget"("postId", "channel");
CREATE INDEX "SocialPostTarget_status_idx" ON "SocialPostTarget"("status");

CREATE TABLE "SocialSlot" (
  "id"        TEXT NOT NULL,
  "channel"   "SocialChannel" NOT NULL,
  "weekday"   INTEGER NOT NULL,
  "time"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialSlot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialSlot_channel_weekday_time_key"
  ON "SocialSlot"("channel", "weekday", "time");
CREATE INDEX "SocialSlot_channel_idx" ON "SocialSlot"("channel");

-- ⚠️ Кино устахад пост үлдэнэ (SetNull) — түүх алдагдах ёсгүй
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_titleId_fkey"
  FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ⚠️ Пост устахад target-ууд хамт (Cascade) — өнчин мөр үлдэхгүй
ALTER TABLE "SocialPostTarget" ADD CONSTRAINT "SocialPostTarget_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
