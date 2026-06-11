-- LessonQuestion.adminUnread — admin уншаагүй мэдэгдлийн badge-д.
-- Хэрэглэгч асуулт асуух / хэрэглэгчийн шинэ хариулт ирэхэд true; admin нээж харахад false.
ALTER TABLE "LessonQuestion" ADD COLUMN "adminUnread" BOOLEAN NOT NULL DEFAULT true;

-- Одоо байгаа асуултуудыг "уншсан" гэж тэмдэглэнэ (хуучин дата спам badge гаргахгүй).
UPDATE "LessonQuestion" SET "adminUnread" = false;

CREATE INDEX "LessonQuestion_adminUnread_idx" ON "LessonQuestion"("adminUnread");
