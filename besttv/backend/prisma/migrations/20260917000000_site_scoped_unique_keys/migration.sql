-- ⚠️⚠️ ГЛОБАЛ unique → САЙТААР ялгаатай composite unique.
--
-- ЯАГААД: `site-extension` нь `upsert`-ийн `where`-д сайтын шүүлт
-- НЭМДЭГГҮЙ (unique түлхүүр эвдэрнэ). Глобал unique үед:
--
--   · ChatConversation — BestFilm-ийн зочин BestTV-д аль хэдийн байгаа
--     `sessionId` илгээвэл шинэ мөр үүсэхгүй, BestTV-ийн ярианы `update`
--     салаа ажиллаж `site` нь `besttv` хэвээр үлдэнэ → BestFilm-ийн
--     зурвас BestTV-ийн админ панелд орно. `sessionId` нь frontend
--     localStorage-оос ирдэг тул халдагч ч, санамсаргүй давхцал ч
--     боломжтой.
--
--   · DeviceToken — нэг төхөөрөмж хоёр аппыг нээвэл BestTV-ийн мөрийн
--     `userId` нь BestFilm хэрэглэгч рүү дарагдана → push БУРУУ ХҮНД.
--
-- ⚠️ АЮУЛГҮЙ: composite нь глобалаас СУЛ хязгаарлалт тул одоо байгаа
-- бүх мөр хүчинтэй хэвээр. Дата УСТГАХГҮЙ, өөрчлөхгүй.
-- (Шалгасан: ChatConversation 1461 мөр, DeviceToken 0 мөр — давхардал
--  үүсэх боломжгүй, учир нь хуучин хязгаарлалт илүү хатуу байсан.)

DROP INDEX IF EXISTS "ChatConversation_sessionId_key";
CREATE UNIQUE INDEX "ChatConversation_sessionId_site_key"
  ON "ChatConversation"("sessionId", "site");

DROP INDEX IF EXISTS "DeviceToken_token_key";
CREATE UNIQUE INDEX "DeviceToken_token_site_key"
  ON "DeviceToken"("token", "site");
