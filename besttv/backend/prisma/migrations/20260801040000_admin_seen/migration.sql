-- Админы sidebar "уншаагүй" badge — хэсэг бүрийг сүүлд харсан огноо
CREATE TABLE "AdminSeen" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminSeen_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdminSeen_adminId_section_key" ON "AdminSeen"("adminId", "section");
CREATE INDEX "AdminSeen_adminId_idx" ON "AdminSeen"("adminId");
ALTER TABLE "AdminSeen" ADD CONSTRAINT "AdminSeen_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
