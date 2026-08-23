-- Badge текст + өнгийг admin өөрөө удирдах (динамик)
ALTER TABLE "Plan" ADD COLUMN "badgeText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Plan" ADD COLUMN "badgeColor" TEXT NOT NULL DEFAULT '';
