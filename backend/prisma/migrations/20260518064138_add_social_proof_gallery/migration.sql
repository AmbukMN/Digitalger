-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "proofAuthorName" TEXT,
ADD COLUMN     "proofAuthorRole" TEXT,
ADD COLUMN     "proofImageUrl" TEXT,
ADD COLUMN     "proofQuote" TEXT,
ADD COLUMN     "proofText" TEXT;

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "videoUrl" TEXT,
ALTER COLUMN "fileKey" SET DEFAULT '';
