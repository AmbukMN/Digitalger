-- FB/IG хавсралт (баримтын зураг). ⚠️ Meta CDN URL хугацаатай тул R2-д хуулна.
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "attachmentKey" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "attachmentType" TEXT;
