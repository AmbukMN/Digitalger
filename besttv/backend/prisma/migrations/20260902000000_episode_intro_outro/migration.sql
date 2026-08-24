-- ИНТРО АЛГАСАХ + ТИТР (дараагийн анги эрт санал болгох)
--
-- ⚠️ Бүгд NULL зөвшөөрсөн тул одоо байгаа ангиуд эвдрэхгүй.
--    NULL = тухайн боломж тэр ангид ОГТ гарахгүй (аюулгүй анхдагч).
ALTER TABLE "Episode" ADD COLUMN "introStartSec" INTEGER;
ALTER TABLE "Episode" ADD COLUMN "introEndSec"   INTEGER;
ALTER TABLE "Episode" ADD COLUMN "outroStartSec" INTEGER;
