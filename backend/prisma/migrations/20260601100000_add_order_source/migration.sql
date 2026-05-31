-- Захиалгын эх сурвалж: PURCHASE (мөнгөөр) | ADMIN_GRANT (админ үнэгүй идэвхжүүлсэн)
ALTER TABLE "Order" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'PURCHASE';
ALTER TABLE "Order" ADD COLUMN "grantedByAdminId" TEXT;
CREATE INDEX "Order_userId_source_idx" ON "Order"("userId", "source");
