-- Bulk/кампанит имэйлийг «фолдер» болгож бүлэглэх
ALTER TABLE "EmailLog" ADD COLUMN "batchId" TEXT;
ALTER TABLE "EmailLog" ADD COLUMN "batchLabel" TEXT;
CREATE INDEX "EmailLog_batchId_createdAt_idx" ON "EmailLog"("batchId", "createdAt");
