-- Утас баталгаажуулалт (verify.mn MO SMS)
ALTER TABLE "User" ADD COLUMN "phoneVerified" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "pendingPhone" TEXT;

CREATE TABLE "PhoneVerifySession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "verifyMnSessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhoneVerifySession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PhoneVerifySession_verifyMnSessionId_key" ON "PhoneVerifySession"("verifyMnSessionId");
CREATE INDEX "PhoneVerifySession_userId_status_idx" ON "PhoneVerifySession"("userId", "status");
CREATE INDEX "PhoneVerifySession_verifyMnSessionId_idx" ON "PhoneVerifySession"("verifyMnSessionId");
