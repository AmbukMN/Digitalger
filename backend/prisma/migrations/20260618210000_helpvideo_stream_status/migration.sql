-- HelpVideo HLS хөрвүүлэлтийн төлөв (processing/ready/error)
ALTER TABLE "HelpVideo" ADD COLUMN "streamStatus" TEXT DEFAULT 'ready';
