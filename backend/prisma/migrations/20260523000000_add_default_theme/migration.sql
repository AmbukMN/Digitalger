-- AlterTable
ALTER TABLE "ThemeSetting" ADD COLUMN IF NOT EXISTS "defaultTheme" TEXT NOT NULL DEFAULT 'system';
