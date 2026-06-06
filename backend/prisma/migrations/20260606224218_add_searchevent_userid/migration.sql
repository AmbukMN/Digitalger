-- AlterTable
ALTER TABLE "SearchEvent" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "SearchEvent_userId_createdAt_idx" ON "SearchEvent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "SearchEvent" ADD CONSTRAINT "SearchEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

