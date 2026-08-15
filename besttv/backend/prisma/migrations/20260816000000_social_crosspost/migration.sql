-- Facebook → Instagram хөндлөн нийтлэлийн бүртгэл

CREATE TYPE "CrosspostStatus" AS ENUM ('QUEUED', 'PROCESSING', 'PUBLISHED', 'FAILED', 'SKIPPED');

CREATE TABLE "SocialCrosspost" (
    "id" TEXT NOT NULL,
    "fbPostId" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "fbPostedAt" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "status" "CrosspostStatus" NOT NULL DEFAULT 'QUEUED',
    "igMediaId" TEXT,
    "caption" TEXT,
    "error" TEXT,
    "mediaKeys" TEXT[],
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialCrosspost_pkey" PRIMARY KEY ("id")
);

-- ⚠️ Нэг FB постыг ХОЁР УДАА нийтлэхээс DB түвшинд сэргийлнэ
CREATE UNIQUE INDEX "SocialCrosspost_fbPostId_key" ON "SocialCrosspost"("fbPostId");
CREATE INDEX "SocialCrosspost_status_createdAt_idx" ON "SocialCrosspost"("status", "createdAt");
CREATE INDEX "SocialCrosspost_fbPostedAt_idx" ON "SocialCrosspost"("fbPostedAt");
