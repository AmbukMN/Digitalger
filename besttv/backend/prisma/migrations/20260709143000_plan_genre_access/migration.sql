-- AlterTable
ALTER TABLE "Genre" ADD COLUMN     "isAdult" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "isVip" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PlanGenre" (
    "planId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,

    CONSTRAINT "PlanGenre_pkey" PRIMARY KEY ("planId","genreId")
);

-- CreateIndex
CREATE INDEX "PlanGenre_genreId_idx" ON "PlanGenre"("genreId");

-- CreateIndex
CREATE INDEX "Genre_isAdult_idx" ON "Genre"("isAdult");

-- AddForeignKey
ALTER TABLE "PlanGenre" ADD CONSTRAINT "PlanGenre_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanGenre" ADD CONSTRAINT "PlanGenre_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE;
