-- Кино ширхэгээр түрээслэх (багц авахгүйгээр нэг киног хугацаатай үзэх)

-- AlterTable — Title дээр түрээсийн тохиргоо
ALTER TABLE "Title" ADD COLUMN     "rentPrice" INTEGER,
ADD COLUMN     "rentHours" INTEGER,
ADD COLUMN     "rentEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Rental" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rental_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rental_userId_titleId_expiresAt_idx" ON "Rental"("userId", "titleId", "expiresAt");

-- CreateIndex
CREATE INDEX "Rental_titleId_createdAt_idx" ON "Rental"("titleId", "createdAt");

-- CreateIndex
CREATE INDEX "Rental_expiresAt_idx" ON "Rental"("expiresAt");

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;
