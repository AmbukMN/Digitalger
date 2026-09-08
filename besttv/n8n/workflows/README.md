# n8n workflow-ийн Code node-ууд

⚠️ Эдгээр нь **n8n-ийн DB-д** хадгалагддаг. Энд байгаа хуулбар нь
код хянах, засварыг мөшгих зорилготой.

## Файлууд

| Файл | Workflow | Node |
|---|---|---|
| `besttv-web-extract-keyword.js` | `BestTVWebChat01` | Extract Keyword |
| `besttv-fb-extract-keyword.js` | `BestTVFBChat01` | Extract Keyword |

## ⚠️ Засах журам

1. Энд засна
2. `node --check` (async wrap-тай — n8n нь `return`-тэй код хүлээдэг)
3. `JSON.stringify` хийж DB-д бичнэ
4. **ХОЁУЛАНД**: `workflow_history` (ажиллаж буй) + `workflow_entity` (draft)
5. DB-ээс дахин уншиж батална
6. `docker restart digitalger-n8n-worker`

⚠️ Нэгийг мартвал засвар ЧИМЭЭГҮЙ ажиллахгүй.

## 2026-09-08 засвар — «99» → «Өнчин охин»

Хэрэглэгчид кинонд хоч өгдөг. Админ `/chat-keywords` хуудсанд
дүрэм нэмнэ. Гурван засвар:

1. **тоо → FAQ БИШ** — `isFaqOnly()` нь `t.length <= 4` шалгуураар
   «99»-ийг FAQ гэж ангилж, хайлт ОГТ хийгддэггүй байв.
2. **`_stripEmoji`-д тоо үлдээх** — тоог хасдаг байсан тул «99» →
   `''` болж, «эмодзи ганцаараа» шалгуур keyword-ыг устгадаг байв.
3. **татгалзлыг таних** — AI «зөвхөн BestTV-ийн кино, БАГЦЫН талаар
   туслах боломжтой» гэж татгалзахад «багц» гэсэн үг орсноор
   `_aiTalkedPlans = true` болж нөөц хайлт зогсдог байв.

⚠️ Гурвуулаа ВЭБ + FB/IG хоёуланд хийгдсэн (гурван суваг ижил).

## ⚠️ ТЕСТ — `chat-test.js`

```bash
node besttv/n8n/workflows/chat-test.js
```

25 тохиолдол: админы түлхүүр, киноны нэр, галиг, FAQ, мэндчилгээ,
жанар, хилийн тохиолдол.

⚠️⚠️ **`curl` ХЭРЭГЛЭЖ БОЛОХГҮЙ** — Windows bash нь кирилл текстийг
`??? ????????` болгож гажуудуулна. Тест бүтэлгүйтэж, БАЙХГҮЙ
асуудлыг «олсон» мэт харагдана (бодит алдаа, 2026-09-08).
Node-ийн `fetch` UTF-8-ыг зөв дамжуулна.

⚠️ Session id нь `zz_qa_` угтвартай. Тестийн дараа ЗААВАЛ цэвэрлэ:

```sql
DELETE FROM "ChatMessage" m USING "ChatConversation" c
 WHERE m."conversationId" = c.id AND c."sessionId" LIKE 'zz_%';
DELETE FROM "ChatConversation" WHERE "sessionId" LIKE 'zz_%';
-- ⚠️ Тестээс өссөн тоолуурыг ч тэглэ
UPDATE "ChatKeyword" SET "hitCount" = 0, "lastHitAt" = NULL;
```

## Emoji + тоо («🎬99»)

Facebook-ийн ice breaker товч нь ҮРГЭЛЖ emoji-тэй илгээдэг.
Хоёр газарт цэвэрлэнэ:

1. `isFaqOnly()` — emoji хассаны дараа тоо үлдвэл FAQ БИШ
2. Fallback-ийн `uq` — «🎬99» → «99» (админы дүрэмтэй таарна)
