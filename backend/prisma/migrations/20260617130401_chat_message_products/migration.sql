-- ChatMessage-д AI санал болгосон бүтээгдэхүүний card (products) нэмэх.
-- Nullable JSONB — байгаа мөрүүдэд NULL, аюулгүй (data алдагдахгүй).
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "products" JSONB;
