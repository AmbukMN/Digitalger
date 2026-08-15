-- Имэйл нээлт бүрийн мөр (өөрийн 1×1 pixel — AWS-гүй).
-- ⚠️ EmailLog.openCount нь НЭГ тоо тул «хэдэн ӨӨР хүн нээв» гэдгийг
--    мэдэх боломжгүй. Энэ хүснэгт нээлт бүрийг тусад нь хадгална.
CREATE TABLE IF NOT EXISTS "EmailOpen" (
  "id"        TEXT NOT NULL,
  "email"     TEXT NOT NULL,
  "logId"     TEXT,
  "template"  TEXT NOT NULL,
  "userAgent" TEXT,
  "openedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailOpen_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmailOpen_template_openedAt_idx" ON "EmailOpen"("template", "openedAt");
CREATE INDEX IF NOT EXISTS "EmailOpen_email_template_idx"    ON "EmailOpen"("email", "template");
CREATE INDEX IF NOT EXISTS "EmailOpen_logId_idx"             ON "EmailOpen"("logId");

-- ⚠️ Маркетинг татгалзал — цуцалсан ХЭРЭГЛЭГЧ рүү broadcast дахин
--    илгээхээс сэргийлнэ (өмнө нь зөвхөн Subscriber-т бичдэг байсан).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "marketingOptOut" BOOLEAN NOT NULL DEFAULT false;
