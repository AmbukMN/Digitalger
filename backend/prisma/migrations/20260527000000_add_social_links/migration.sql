-- AlterTable
ALTER TABLE "SiteSetting"
  ADD COLUMN IF NOT EXISTS "socialFacebook"  TEXT,
  ADD COLUMN IF NOT EXISTS "socialInstagram" TEXT,
  ADD COLUMN IF NOT EXISTS "socialTwitter"   TEXT,
  ADD COLUMN IF NOT EXISTS "socialThreads"   TEXT,
  ADD COLUMN IF NOT EXISTS "socialTelegram"  TEXT,
  ADD COLUMN IF NOT EXISTS "socialWhatsapp"  TEXT,
  ADD COLUMN IF NOT EXISTS "socialTiktok"    TEXT,
  ADD COLUMN IF NOT EXISTS "socialYoutube"   TEXT,
  ADD COLUMN IF NOT EXISTS "socialLinkedin"  TEXT;
