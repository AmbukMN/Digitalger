-- CreateTable
CREATE TABLE "DownloadLog" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "userId" TEXT,
    "fileName" TEXT,
    "source" TEXT NOT NULL DEFAULT 'paid',
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DownloadLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DownloadLog_productId_createdAt_idx" ON "DownloadLog"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "DownloadLog_userId_createdAt_idx" ON "DownloadLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DownloadLog_createdAt_idx" ON "DownloadLog"("createdAt");

-- AddForeignKey
ALTER TABLE "DownloadLog" ADD CONSTRAINT "DownloadLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DownloadLog" ADD CONSTRAINT "DownloadLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

