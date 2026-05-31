-- Бодит таталтын тоолуур (хэрэглэгчид татсан жинхэнэ тоо, зөвхөн admin)
ALTER TABLE "Product" ADD COLUMN "realDownloadCount" INTEGER NOT NULL DEFAULT 0;
