-- АЛДААНЫ БҮРТГЭЛ — production дээрх алдааг хайж олоход
CREATE TABLE "ErrorLog" (
    "id"        TEXT NOT NULL,
    "source"    TEXT NOT NULL,
    "message"   TEXT NOT NULL,
    "stack"     TEXT,
    "path"      TEXT,
    "userId"    TEXT,
    "userAgent" TEXT,
    "meta"      JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ErrorLog_createdAt_idx"         ON "ErrorLog"("createdAt");
CREATE INDEX "ErrorLog_source_createdAt_idx"  ON "ErrorLog"("source", "createdAt");
CREATE INDEX "ErrorLog_userId_idx"            ON "ErrorLog"("userId");

-- ⚠️ SET NULL — хэрэглэгч устгахад алдааны лог УСТАХГҮЙ (шалгах хэрэгтэй)
ALTER TABLE "ErrorLog" ADD CONSTRAINT "ErrorLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
