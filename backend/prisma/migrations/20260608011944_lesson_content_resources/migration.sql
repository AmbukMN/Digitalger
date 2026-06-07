-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "content" TEXT;

-- CreateTable
CREATE TABLE "LessonResource" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonResource_lessonId_idx" ON "LessonResource"("lessonId");

-- AddForeignKey
ALTER TABLE "LessonResource" ADD CONSTRAINT "LessonResource_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

