-- AlterTable: Notification model-д type/link нэмэх
ALTER TABLE "Notification" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'info';
ALTER TABLE "Notification" ADD COLUMN "link" TEXT;

-- CreateIndex: unreadCount + жагсаалт хурдан
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
