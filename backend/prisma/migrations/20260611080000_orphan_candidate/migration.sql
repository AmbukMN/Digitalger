-- OrphanCandidate — R2 orphan файлын "хогийн сав" (soft delete, 3 хоног grace).
CREATE TABLE "OrphanCandidate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "size" INTEGER,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrphanCandidate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrphanCandidate_key_key" ON "OrphanCandidate"("key");
CREATE INDEX "OrphanCandidate_firstSeenAt_idx" ON "OrphanCandidate"("firstSeenAt");
