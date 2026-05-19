-- Migration: add_course_modules_coupons_phone_guest
-- This migration captures schema changes applied via prisma db push:
-- 1. User: phone, isGuest fields
-- 2. Order: couponCode field
-- 3. Lesson: moduleId, videoUrl, isFreePreview fields
-- 4. CourseModule model
-- 5. Coupon model + CouponType enum

-- ── User: phone, isGuest ─────────────────────────────────────────────────────
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isGuest" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone");

-- ── Order: couponCode ────────────────────────────────────────────────────────
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "couponCode" TEXT;

-- ── Lesson: moduleId, videoUrl, isFreePreview ────────────────────────────────
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "moduleId" TEXT;
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT;
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "isFreePreview" BOOLEAN NOT NULL DEFAULT false;

-- ── CourseModule ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CourseModule" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CourseModule_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CourseModule"
    ADD CONSTRAINT "CourseModule_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
    DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "Lesson"
    ADD CONSTRAINT "Lesson_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "CourseModule"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
    DEFERRABLE INITIALLY DEFERRED;

-- ── CouponType enum ──────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE "CouponType" AS ENUM ('PERCENT', 'FIXED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ── Coupon ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "CouponType" NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "minPrice" DECIMAL(12,2),
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_code_key" ON "Coupon"("code");
