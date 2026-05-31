-- Имэйл солих verify flow: шинэ имэйлийг баталгаажтал түр хадгалах багана.
-- User.email зөвхөн OTP амжилттай баталгаажсаны дараа л солигдоно.
ALTER TABLE "User" ADD COLUMN "pendingEmail" TEXT;
