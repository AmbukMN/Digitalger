// Facebook webhook-оос ирсэн мессеж/postback/quick_reply-ийг задлах.
// Текст мессеж + Get Started postback + Ice Breaker/Quick Reply товчнуудыг боловсруулна.
const body = $input.first().json.body;
if (!body || body.object !== 'page') return [];

// Товчны payload-уудыг AI-д ойлгомжтой текст асуулт болгон хөрвүүлнэ.
// → AI Agent ердийн хайлт/хариулт хийнэ ([SEARCH:...] эсвэл шууд хариу).
const PAYLOAD_TO_TEXT = {
  GET_STARTED: '__GET_STARTED__',
  // Ice Breaker / Quick Reply товчнууд (анх чат нээхэд гарах 4 товч)
  IB_ALL_PRODUCTS: 'Бүх бүтээгдэхүүн үзэх',
  IB_PROJECTS: 'Бэлэн бичсэн төслүүд',
  IB_DOCUMENTS: 'Баримтын иж бүрдэл',
  IB_DOWNLOAD: 'Татаж авах заавар',
  // Хуучин payload-ууд (нийцтэй байх үүднээс хадгална)
  IB_BOOKS: 'ном',
  IB_PRICING: 'үнэ төлбөрийн мэдээлэл',
};

const out = [];
for (const entry of (body.entry || [])) {
  for (const msg of (entry.messaging || [])) {
    const psid = String(msg.sender && msg.sender.id || '');
    if (!psid) continue;

    // 1) Postback (Get Started товч)
    if (msg.postback && msg.postback.payload) {
      const mapped = PAYLOAD_TO_TEXT[msg.postback.payload];
      const text = mapped || String(msg.postback.title || msg.postback.payload).trim();
      out.push({ json: { psid, text, isPostback: true } });
      continue;
    }

    // 2) Quick Reply / Ice Breaker товч (message.quick_reply.payload)
    if (msg.message && msg.message.quick_reply && msg.message.quick_reply.payload) {
      const p = msg.message.quick_reply.payload;
      const mapped = PAYLOAD_TO_TEXT[p];
      // Payload mapping байхгүй бол товчны харагдах текстийг ашиглана
      const text = mapped || String(msg.message.text || p).trim();
      out.push({ json: { psid, text, isPostback: true } });
      continue;
    }

    // 3) Энгийн текст мессеж (echo, attachment алгасна)
    if (msg.message && !msg.message.is_echo && msg.message.text) {
      out.push({ json: { psid, text: String(msg.message.text).trim(), isPostback: false } });
    }
  }
}
return out;
