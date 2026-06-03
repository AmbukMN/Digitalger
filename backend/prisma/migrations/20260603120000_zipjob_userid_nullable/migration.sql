-- ZipJob.userId-ийг nullable болгов (үнэгүй бүтээгдэхүүний нийтийн zip-д хэрэглэгч байхгүй)
ALTER TABLE "ZipJob" ALTER COLUMN "userId" DROP NOT NULL;
