-- Нууц үг сэргээх (forgot password) токен.
-- ⚠️ Түүхий токен ХАДГАЛАГДАХГҮЙ — зөвхөн SHA-256 хэш. DB задарсан ч
-- халдлагч сэргээх линкийг дахин үүсгэж чадахгүй.

CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- ⚠️ UNIQUE — токеноор хайх нь ЦОРЫН ГАНЦ хайлт (хэрэглэгч нэвтрээгүй тул
-- userId мэдэгдэхгүй). Индексгүй бол бүтэн table scan болно.
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_createdAt_idx" ON "PasswordResetToken"("userId", "createdAt");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
