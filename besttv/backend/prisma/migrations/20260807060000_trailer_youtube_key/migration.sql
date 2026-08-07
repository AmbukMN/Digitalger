-- ⚠️ YouTube трейлерийн key — TMDB-ээс ирнэ.
-- `trailerKey` (манай R2 HLS зам)-ААС ТУСДАА байх ЁСТОЙ: хоёуланг нэг
-- талбарт хийвэл player YouTube key-г m3u8 гэж үзээд эвдэрнэ.
ALTER TABLE "Title" ADD COLUMN "trailerYoutubeKey" TEXT;
