-- Help Assistant: HelpVideo хүснэгт + FAQ.showInHelp багана

-- FAQ-д help panel-д харуулах эсэх (default false)
ALTER TABLE "FAQ" ADD COLUMN "showInHelp" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "FAQ_showInHelp_active_idx" ON "FAQ"("showInHelp", "active");

-- HelpVideo хүснэгт (видео заавар)
CREATE TABLE "HelpVideo" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "videoUrl" TEXT,
    "videoKey" TEXT,
    "videoStreamId" TEXT,
    "posterKey" TEXT,
    "durationLabel" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpVideo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HelpVideo_active_sortOrder_idx" ON "HelpVideo"("active", "sortOrder");
CREATE INDEX "HelpVideo_createdByUserId_idx" ON "HelpVideo"("createdByUserId");

ALTER TABLE "HelpVideo" ADD CONSTRAINT "HelpVideo_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
