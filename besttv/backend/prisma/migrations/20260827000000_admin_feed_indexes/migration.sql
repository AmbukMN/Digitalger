-- Админы мэдэгдлийн жагсаалтын индексүүд.
--
-- ⚠️ Админ хуудас 30 секунд тутам polling хийдэг ба гурван асуулга
-- индексгүй эрэмбэлдэг тул бүх хүснэгтийг уншиж эрэмбэлдэг байв.
CREATE INDEX "Payment_status_paidAt_idx" ON "Payment"("status", "paidAt");
CREATE INDEX "Review_createdAt_idx" ON "Review"("createdAt");
CREATE INDEX "ChatMessage_role_createdAt_idx" ON "ChatMessage"("role", "createdAt");
