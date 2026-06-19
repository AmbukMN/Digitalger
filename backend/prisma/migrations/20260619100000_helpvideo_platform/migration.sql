-- HelpVideo platform: 'all' (help panel + бүгд) | 'desktop' | 'mobile'
-- Product detail хуудсанд дэлгэцээс хамаарч видео сонгох.
ALTER TABLE "HelpVideo" ADD COLUMN "platform" TEXT DEFAULT 'all';
