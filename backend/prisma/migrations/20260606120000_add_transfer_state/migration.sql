-- CreateTable
CREATE TABLE "TransferState" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransferState_expiresAt_idx" ON "TransferState"("expiresAt");

