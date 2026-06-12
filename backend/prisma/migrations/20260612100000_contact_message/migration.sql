-- ContactMessage — холбоо барих (contact form) мессежийг DB-д хадгална.
-- Өмнө зөвхөн имэйлд явдаг байсныг алдагдахаас сэргийлж admin жагсаалт + notify-д.
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContactMessage_read_createdAt_idx" ON "ContactMessage"("read", "createdAt");
