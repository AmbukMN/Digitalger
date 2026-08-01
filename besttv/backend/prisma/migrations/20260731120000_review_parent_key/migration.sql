-- DropIndex
DROP INDEX "Review_userId_titleId_parentId_key";

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "parentKey" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_titleId_parentKey_key" ON "Review"("userId", "titleId", "parentKey");

