-- AlterTable
ALTER TABLE "SiteSetting" ADD COLUMN     "certSignatureUrl" TEXT,
ADD COLUMN     "certSignerName" TEXT DEFAULT 'Б. Амгаланбаяр',
ADD COLUMN     "certSignerTitle" TEXT DEFAULT 'Гүйцэтгэх захирал';

