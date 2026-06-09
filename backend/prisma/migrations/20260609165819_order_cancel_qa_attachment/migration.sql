-- AlterTable
ALTER TABLE "LessonQuestion" ADD COLUMN     "attachmentKey" TEXT,
ADD COLUMN     "attachmentMimeType" TEXT,
ADD COLUMN     "attachmentName" TEXT,
ADD COLUMN     "attachmentSize" INTEGER;

-- AlterTable
ALTER TABLE "LessonAnswer" ADD COLUMN     "attachmentKey" TEXT,
ADD COLUMN     "attachmentMimeType" TEXT,
ADD COLUMN     "attachmentName" TEXT,
ADD COLUMN     "attachmentSize" INTEGER;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledBy" TEXT;

