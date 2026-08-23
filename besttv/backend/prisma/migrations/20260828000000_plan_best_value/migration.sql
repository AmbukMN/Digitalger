-- «Хамгийн ашигтай» тэмдгийг admin-аас удирдах (өмнө бүх VIP-д авто гардаг байв)
ALTER TABLE "Plan" ADD COLUMN "isBestValue" BOOLEAN NOT NULL DEFAULT false;
