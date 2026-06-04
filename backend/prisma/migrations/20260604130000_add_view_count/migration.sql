-- Product болон BlogPost-д viewCount талбар (бодит үзэлт/уншилт)
ALTER TABLE "Product" ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BlogPost" ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;
