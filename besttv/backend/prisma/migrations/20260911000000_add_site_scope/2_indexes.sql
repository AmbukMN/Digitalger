-- ⚠️⚠️ BESTFILM MIGRATION — 2/3 · ИНДЕКС
--
-- ⚠️⚠️ ТРАНЗАКЦААС ГАДНА АЖИЛЛУУЛНА — BEGIN/COMMIT БАЙХГҮЙ!
--    `CREATE INDEX CONCURRENTLY` нь транзакц дотор ажиллахгүй.
--    psql-д НЭГ БҮРЧЛЭН, эсвэл `psql -f` (autocommit) ашиглана.
--
-- ⚠️ CONCURRENTLY нь 2-3 дахин удаан ч БИЧИЛТ ЗОГСООХГҮЙ.
--    Энгийн CREATE INDEX бол TitleEvent (366K) дээр 5-20 секунд
--    бүх бичилтийг зогсооно.
--
-- ⚠️ lock_timeout ТАВИХГҮЙ — CONCURRENTLY нь удаан хүлээж болно,
--    гэхдээ бичилт зогсоохгүй тул аюулгүй.
--
-- ⚠️⚠️ ДУУССАНЫ ДАРАА ЗААВАЛ ШАЛГА:
--    SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;
--    → хоосон байх ЁСТОЙ. CONCURRENTLY нь ЧИМЭЭГҮЙ унаж INVALID
--      индекс үлдээж болно (тэр нь query-д ашиглагдахгүй).

CREATE INDEX CONCURRENTLY IF NOT EXISTS "AdminSeen_site_idx" ON "AdminSeen"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "BankAccount_site_idx" ON "BankAccount"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "BankAccount_site_createdAt_idx" ON "BankAccount"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "BlogPost_site_idx" ON "BlogPost"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "BlogPost_site_createdAt_idx" ON "BlogPost"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatConversation_starred_lastMessageAt_idx" ON "ChatConversation"("starred", "lastMessageAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatConversation_site_idx" ON "ChatConversation"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatConversation_site_createdAt_idx" ON "ChatConversation"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_site_idx" ON "ChatMessage"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_site_createdAt_idx" ON "ChatMessage"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Coupon_site_idx" ON "Coupon"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Coupon_site_createdAt_idx" ON "Coupon"("site", "createdAt");
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "Coupon_code_site_key" ON "Coupon"("code", "site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "DeviceToken_site_idx" ON "DeviceToken"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "DeviceToken_site_createdAt_idx" ON "DeviceToken"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Download_site_idx" ON "Download"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Download_site_createdAt_idx" ON "Download"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "EmailLog_site_idx" ON "EmailLog"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "EmailLog_site_createdAt_idx" ON "EmailLog"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "EmailOpen_site_idx" ON "EmailOpen"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "EmailOtp_site_idx" ON "EmailOtp"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "EmailOtp_site_createdAt_idx" ON "EmailOtp"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "EmailSuppression_site_idx" ON "EmailSuppression"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "EmailSuppression_site_createdAt_idx" ON "EmailSuppression"("site", "createdAt");
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "EmailSuppression_email_site_key" ON "EmailSuppression"("email", "site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "EmailTemplateOverride_site_idx" ON "EmailTemplateOverride"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "EmailTemplateOverride_site_createdAt_idx" ON "EmailTemplateOverride"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "EmailTemplateSaved_site_idx" ON "EmailTemplateSaved"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "EmailTemplateSaved_site_createdAt_idx" ON "EmailTemplateSaved"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ErrorLog_site_idx" ON "ErrorLog"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ErrorLog_site_createdAt_idx" ON "ErrorLog"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Faq_site_idx" ON "Faq"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Faq_site_createdAt_idx" ON "Faq"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "HomeBanner_site_idx" ON "HomeBanner"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "HomeBanner_site_createdAt_idx" ON "HomeBanner"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "MyListItem_site_idx" ON "MyListItem"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "MyListItem_site_createdAt_idx" ON "MyListItem"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Notification_site_idx" ON "Notification"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Notification_site_createdAt_idx" ON "Notification"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Page_site_idx" ON "Page"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Page_site_createdAt_idx" ON "Page"("site", "createdAt");
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "Page_slug_site_key" ON "Page"("slug", "site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PageView_site_idx" ON "PageView"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PageView_site_createdAt_idx" ON "PageView"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PasswordResetToken_site_idx" ON "PasswordResetToken"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PasswordResetToken_site_createdAt_idx" ON "PasswordResetToken"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Payment_site_idx" ON "Payment"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Payment_site_createdAt_idx" ON "Payment"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PhoneVerifySession_site_idx" ON "PhoneVerifySession"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PhoneVerifySession_site_createdAt_idx" ON "PhoneVerifySession"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Plan_site_idx" ON "Plan"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Plan_site_createdAt_idx" ON "Plan"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PlanGenre_site_idx" ON "PlanGenre"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Promotion_site_idx" ON "Promotion"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Promotion_site_createdAt_idx" ON "Promotion"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PromotionPlan_site_idx" ON "PromotionPlan"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PromotionRedemption_site_idx" ON "PromotionRedemption"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PromotionRedemption_site_createdAt_idx" ON "PromotionRedemption"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Rental_site_idx" ON "Rental"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Rental_site_createdAt_idx" ON "Rental"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Review_site_idx" ON "Review"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Review_site_createdAt_idx" ON "Review"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ReviewReport_site_idx" ON "ReviewReport"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ReviewReport_site_createdAt_idx" ON "ReviewReport"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ReviewVote_site_idx" ON "ReviewVote"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ReviewVote_site_createdAt_idx" ON "ReviewVote"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SavedCard_site_idx" ON "SavedCard"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SavedCard_site_createdAt_idx" ON "SavedCard"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SearchEvent_site_idx" ON "SearchEvent"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SearchEvent_site_createdAt_idx" ON "SearchEvent"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SocialChannelSetting_site_idx" ON "SocialChannelSetting"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SocialCrosspost_site_idx" ON "SocialCrosspost"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SocialCrosspost_site_createdAt_idx" ON "SocialCrosspost"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SocialPost_site_idx" ON "SocialPost"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SocialPost_site_createdAt_idx" ON "SocialPost"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SocialPostTarget_site_idx" ON "SocialPostTarget"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SocialPostTarget_site_createdAt_idx" ON "SocialPostTarget"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SocialRelay_site_idx" ON "SocialRelay"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SocialRelay_site_createdAt_idx" ON "SocialRelay"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SocialSlot_site_idx" ON "SocialSlot"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SocialSlot_site_createdAt_idx" ON "SocialSlot"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Subscriber_site_idx" ON "Subscriber"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Subscriber_site_createdAt_idx" ON "Subscriber"("site", "createdAt");
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "Subscriber_email_site_key" ON "Subscriber"("email", "site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Subscription_site_idx" ON "Subscription"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Subscription_site_createdAt_idx" ON "Subscription"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Title_sites_idx" ON "Title" USING GIN ("sites");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "TitleEvent_site_idx" ON "TitleEvent"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "TitleEvent_site_createdAt_idx" ON "TitleEvent"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_site_idx" ON "User"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_site_createdAt_idx" ON "User"("site", "createdAt");
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "User_email_site_key" ON "User"("email", "site");
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "User_phone_site_key" ON "User"("phone", "site");
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "User_googleId_site_key" ON "User"("googleId", "site");
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "User_facebookId_site_key" ON "User"("facebookId", "site");
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "User_appleId_site_key" ON "User"("appleId", "site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserAuditLog_site_idx" ON "UserAuditLog"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserAuditLog_site_createdAt_idx" ON "UserAuditLog"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserSession_site_idx" ON "UserSession"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserSession_site_createdAt_idx" ON "UserSession"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "WalletTransaction_site_idx" ON "WalletTransaction"("site");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "WalletTransaction_site_createdAt_idx" ON "WalletTransaction"("site", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "WatchProgress_site_idx" ON "WatchProgress"("site");

-- ⚠️ ШАЛГАХ (заавал!):
-- SELECT indexrelid::regclass AS invalid_index FROM pg_index WHERE NOT indisvalid;
