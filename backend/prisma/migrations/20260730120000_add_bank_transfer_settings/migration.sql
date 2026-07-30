-- Дансаар шилжүүлэх төлбөрийн тохиргоо (SiteSetting)
ALTER TABLE "SiteSetting" ADD COLUMN "bankTransferEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SiteSetting" ADD COLUMN "bankName" TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN "bankAccountNumber" TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN "bankAccountName" TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN "bankTransferNote" TEXT;
