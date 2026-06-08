// Хуучин n8n_chat_memory яриаг ChatConversation/ChatMessage-руу нэг удаа import.
// VPS дээр: docker cp энэ файл + /tmp/n8nchat.txt → backend container → node ажиллуулна.
// Формат (мөр): id|session_id|message_json ({type:human|ai, content})
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function channelOf(sessionId) {
  // web_ эхэлсэн = web chat, бусад (FB psid урт тоо / нэр) = facebook
  if (/^web[_-]/i.test(sessionId)) return 'web';
  return 'facebook';
}

// human content-оос зөвхөн бодит хэрэглэгчийн мессежийг авах (хайлт/заавар хэсэг хасна).
function cleanUserText(content) {
  let t = String(content || '');
  const marker = '=== ХЭРЭГЛЭГЧИЙН МЕССЕЖ ===';
  if (t.includes(marker)) {
    t = t.split(marker)[1] || '';
    // дараагийн === ... === хэсгийг таслана
    t = t.split('===')[0];
  }
  return t.trim();
}

async function main() {
  const lines = fs.readFileSync('/tmp/n8nchat.txt', 'utf8').split('\n').filter(Boolean);
  // session_id → мессежүүд (дарааллаар)
  const bySession = new Map();
  for (const line of lines) {
    const firstPipe = line.indexOf('|');
    const secondPipe = line.indexOf('|', firstPipe + 1);
    if (firstPipe < 0 || secondPipe < 0) continue;
    const sessionId = line.slice(firstPipe + 1, secondPipe).trim();
    const jsonStr = line.slice(secondPipe + 1).trim();
    if (!sessionId || !jsonStr) continue;
    let msg;
    try { msg = JSON.parse(jsonStr); } catch { continue; }
    const type = msg.type; // human | ai
    if (type !== 'human' && type !== 'ai') continue;
    const role = type === 'human' ? 'user' : 'assistant';
    let text = role === 'user' ? cleanUserText(msg.content) : String(msg.content || '').trim();
    if (!text) continue;
    if (text.length > 8000) text = text.slice(0, 8000);
    if (!bySession.has(sessionId)) bySession.set(sessionId, []);
    bySession.get(sessionId).push({ role, text });
  }

  let convCount = 0, msgCount = 0;
  for (const [sessionId, msgs] of bySession) {
    if (!msgs.length) continue;
    // Аль хэдийн байгаа бол алгасах (давхар import-аас сэргийлэх)
    const existing = await prisma.chatConversation.findUnique({ where: { sessionId } });
    if (existing) continue;
    const conv = await prisma.chatConversation.create({
      data: {
        channel: channelOf(sessionId),
        sessionId,
        lastMessageAt: new Date(),
        messages: { create: msgs.map((m) => ({ role: m.role, text: m.text })) },
      },
    });
    convCount++;
    msgCount += msgs.length;
  }
  console.log(`IMPORTED: ${convCount} conversations, ${msgCount} messages`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error('IMPORT ERROR:', e.message); process.exit(1); });
