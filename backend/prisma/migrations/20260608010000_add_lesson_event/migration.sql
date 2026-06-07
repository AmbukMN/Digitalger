-- CreateTable
CREATE TABLE "LessonEvent" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "productId" TEXT,
    "sessionId" TEXT,
    "userId" TEXT,
    "watchedSeconds" INTEGER,
    "durationSec" INTEGER,
    "playbackSpeed" DOUBLE PRECISION,
    "position" INTEGER,
    "device" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonEvent_lessonId_event_idx" ON "LessonEvent"("lessonId", "event");

-- CreateIndex
CREATE INDEX "LessonEvent_event_createdAt_idx" ON "LessonEvent"("event", "createdAt");

-- CreateIndex
CREATE INDEX "LessonEvent_productId_event_createdAt_idx" ON "LessonEvent"("productId", "event", "createdAt");

-- CreateIndex
CREATE INDEX "LessonEvent_userId_createdAt_idx" ON "LessonEvent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "LessonEvent" ADD CONSTRAINT "LessonEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
