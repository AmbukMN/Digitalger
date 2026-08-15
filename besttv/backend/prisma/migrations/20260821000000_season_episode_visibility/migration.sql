-- Улирал / анги нуух тохиргоо.
-- ⚠️ default true — өмнөх бүх улирал/анги ХАРАГДСААР байна (regression гарахгүй).
ALTER TABLE "Season" ADD COLUMN "isVisible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Episode" ADD COLUMN "isVisible" BOOLEAN NOT NULL DEFAULT true;
