-- WALLET_BONUS урамшууллын бонусыг ADMIN_CREDIT-ээс ялгах шинэ төрөл
ALTER TYPE "WalletTxType" ADD VALUE IF NOT EXISTS 'BONUS';
