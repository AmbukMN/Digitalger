-- ГАР УТАСНЫ АППЫН PUSH ТОКЕН
-- ⚠️ `UserSession`-ЭЭС ТУСДАА: session нь гарахад устдаг, push токен нь
--    төхөөрөмжийн шинж чанар тул үлдэнэ.
CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT,
    "deviceName" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

-- ⚠️ UNIQUE: Expo нэг төхөөрөмжид нэг токен өгдөг. Хэрэглэгч солигдвол
--    upsert-ээр `userId` шинэчилнэ (өмнөх хүний мэдэгдэл очихгүй).
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");

-- Хэрэглэгчийн бүх идэвхтэй төхөөрөмж рүү илгээх гол query
CREATE INDEX "DeviceToken_userId_enabled_idx" ON "DeviceToken"("userId", "enabled");

ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ⚠️ Session-д platform: Expo/RN нь `okhttp` UA илгээдэг тул User-Agent-аас
--    таамаглах нь «Тодорхойгүй төхөөрөмж» гэж харагдана (батлагдсан).
ALTER TABLE "UserSession" ADD COLUMN "platform" TEXT;
ALTER TABLE "UserSession" ADD COLUMN "appVersion" TEXT;
