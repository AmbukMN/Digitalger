CREATE TABLE IF NOT EXISTS "ProductTypeConfig" (
  "id"          TEXT NOT NULL,
  "value"       TEXT NOT NULL,
  "label"       TEXT NOT NULL,
  "description" TEXT,
  "icon"        TEXT,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "active"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductTypeConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductTypeConfig_value_key" ON "ProductTypeConfig"("value");
CREATE INDEX IF NOT EXISTS "ProductTypeConfig_active_sortOrder_idx" ON "ProductTypeConfig"("active", "sortOrder");

-- Seed default product types
INSERT INTO "ProductTypeConfig" ("id", "value", "label", "description", "sortOrder", "active", "updatedAt")
VALUES
  ('ptc_file',     'FILE',     'Файл',        'Татаж авах дижитал файлууд',                 0, true, CURRENT_TIMESTAMP),
  ('ptc_tmpl',     'TEMPLATE', 'Загвар',      'Бэлэн загвар болон шаблонууд',               1, true, CURRENT_TIMESTAMP),
  ('ptc_doc',      'DOCUMENT', 'Баримт',      'Баримт бичгийн загварууд',                   2, true, CURRENT_TIMESTAMP),
  ('ptc_vid',      'VIDEO',    'Видео',        'Видео хичээл болон контент',                 3, true, CURRENT_TIMESTAMP),
  ('ptc_lesson',   'LESSON',   'Хичээл',      'Дижитал хичээлүүд',                          4, true, CURRENT_TIMESTAMP),
  ('ptc_bundle',   'BUNDLE',   'Багц',        'Хичээл болон файлын цуглуулга',              5, true, CURRENT_TIMESTAMP),
  ('ptc_hybrid',   'HYBRID',   'Хосолсон',    'Файл болон хичээлийн хосолсон багц',         6, true, CURRENT_TIMESTAMP)
ON CONFLICT ("value") DO NOTHING;
