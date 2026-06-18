-- Help video / FAQ үзэлт лог (хэрэглэгчээр + нийт үзэлт tracking)

CREATE TABLE "HelpVideoView" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "device" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HelpVideoView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HelpVideoView_videoId_viewedAt_idx" ON "HelpVideoView"("videoId", "viewedAt");
CREATE INDEX "HelpVideoView_userId_viewedAt_idx" ON "HelpVideoView"("userId", "viewedAt");
CREATE INDEX "HelpVideoView_sessionId_idx" ON "HelpVideoView"("sessionId");

ALTER TABLE "HelpVideoView" ADD CONSTRAINT "HelpVideoView_videoId_fkey"
    FOREIGN KEY ("videoId") REFERENCES "HelpVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HelpVideoView" ADD CONSTRAINT "HelpVideoView_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "FAQView" (
    "id" TEXT NOT NULL,
    "faqId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "device" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FAQView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FAQView_faqId_viewedAt_idx" ON "FAQView"("faqId", "viewedAt");
CREATE INDEX "FAQView_userId_viewedAt_idx" ON "FAQView"("userId", "viewedAt");
CREATE INDEX "FAQView_sessionId_idx" ON "FAQView"("sessionId");

ALTER TABLE "FAQView" ADD CONSTRAINT "FAQView_faqId_fkey"
    FOREIGN KEY ("faqId") REFERENCES "FAQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FAQView" ADD CONSTRAINT "FAQView_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
