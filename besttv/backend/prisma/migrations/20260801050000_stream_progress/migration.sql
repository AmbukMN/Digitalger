-- HLS хөрвүүлэлтийн явц + гацсаныг илрүүлэх талбарууд
ALTER TABLE "Title"
  ADD COLUMN IF NOT EXISTS "streamProgress" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "streamStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "streamError" TEXT;

ALTER TABLE "Episode"
  ADD COLUMN IF NOT EXISTS "streamProgress" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "streamStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "streamError" TEXT;
