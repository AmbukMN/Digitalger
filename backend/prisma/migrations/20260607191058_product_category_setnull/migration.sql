-- Category устгахад түүнийг ашиглаж буй Product-уудын categoryId автомат NULL
-- болгоно (өмнө onDelete заагаагүй тул category устгахад FK блоклож/product
-- засахад 500 алдаа гардаг байсан). Constraint-ийг дахин үүсгэж ON DELETE SET NULL.

-- FK нэр Prisma-ийн default: "Product_categoryId_fkey"
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_categoryId_fkey";
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
