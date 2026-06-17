-- Admin chat human-handoff: gar hariu өгөх талбарууд (nullable/default — аюулгүй).
ALTER TABLE "ChatConversation" ADD COLUMN IF NOT EXISTS "adminUnread" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChatConversation" ADD COLUMN IF NOT EXISTS "handedOff" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChatConversation" ADD COLUMN IF NOT EXISTS "userUnreadCount" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "ChatConversation_adminUnread_lastMessageAt_idx" ON "ChatConversation"("adminUnread", "lastMessageAt");
