/**
 * BestTV — Facebook/Instagram чатбот workflow үүсгэнэ.
 *
 * DigitalGer-ийн `CNamkzJ1xMqWKWOr` workflow-г БҮТНЭЭР хөрвүүлсэн:
 *   1. Messenger AI чат (FB + IG)
 *   2. Comment auto-reply + private DM
 *   3. Webhook verify (GET challenge)
 *
 * ⚠️ Page/IG ID болон token нь ЗОРИУД hardcode — $env-ээр дамжуулахад
 *    n8n Code node-д хүрэхгүй байсан (DigitalGer дээр батлагдсан).
 */
const fs = require('fs');

// ─── BestTV-ийн ТОГТМОЛУУД (ss-үүдээс) ──────────────────────────────
const PAGE_ID = '108103720808038';
const IG_ID = '17841442595556819';
const TOKEN = process.env.BESTTV_FB_TOKEN || '__BESTTV_PAGE_TOKEN__';
/**
 * ⚠️⚠️ ДОТООД хаяг — `https://api.besttv.us` БИШ.
 *
 * n8n болон backend нэг docker сүлжээнд (`digitalger-n8n-network`)
 * байдаг тул шууд холбогдоно. Ашиг:
 *   1. Cloudflare-ийн rate limit ТОЙРНО — гадуур явбал 60 хүсэлтээс
 *      15 нь 429 болж чат чимээгүй алдагддаг (production тестээр
 *      батлагдсан: гадуур 45/60, дотуур 60/60)
 *   2. Хурдан (DNS + TLS + CF hop байхгүй)
 *   3. Интернэт тасарсан ч ажиллана
 *
 * ⚠️ Facebook Graph API нь ГАДНЫХ тул тэр нь `https://graph.facebook.com`
 * хэвээр — зөвхөн BestTV-ийн өөрийн API дотоод хаягаар.
 */
const API = process.env.BESTTV_API || 'http://besttv-backend:4100/api';
const SITE = 'https://besttv.us';
const WEBHOOK_PATH = 'besttv-facebook-webhook';
const VERIFY_TOKEN = process.env.BESTTV_VERIFY_TOKEN || 'BestTV2026Verify';
/**
 * ⚠️ Backend-ийн throttle-ыг тойрох secret. n8n-ийн БҮХ хүсэлт нэг
 * IP-ээс ирдэг тул хязгаарт хурдан унадаг — 50 хэрэглэгч зэрэг
 * бичихэд 30 нь 429 болж чат чимээгүй алдагдаж байв.
 */
const BOT_SECRET = process.env.BESTTV_BOT_SECRET || '__BOT_SECRET__';

const G = 'https://graph.facebook.com/v21.0';
const nodes = [];
/**
 * ⚠️⚠️ HTTP node бүрд onError АВТОМАТААР нэмнэ.
 *
 * neverError нь зөвхөн HTTP СТАТУС кодыг (4xx/5xx) залгидаг —
 * connection refused, DNS алдаа, TIMEOUT зэргийг БАРИХГҮЙ. Backend
 * түр удаашрах эсвэл container restart хийхэд workflow БҮХЭЛДЭЭ
 * унаж, хэрэглэгч ямар ч хариу авахгүй.
 *
 * ⚠️ DigitalGer-т эдгээр node бүр continueRegularOutput-той —
 * BestTV рүү хөрвүүлэхэд орхигдсон байв.
 *
 * ⚠️ Аль хэдийн onError заасан node-ыг (Send Cards →
 * continueErrorOutput) ХЭВЭЭР үлдээнэ.
 */
const add = (o) => {
  if (o.type === 'n8n-nodes-base.httpRequest') {
    if (!o.onError) o.onError = 'continueRegularOutput';
    /**
     * ⚠️⚠️ alwaysOutputData — 0 item буцаахад урсгал ТАСАРНА.
     *
     * API хоосон массив `[]` эсвэл 404 буцаавал n8n дараагийн node-ыг
     * ОГТ эхлүүлэхгүй, execution `running`-д мөнхөрнө. Production
     * тестээр батлагдсан: 50 мессежээс 20 нь ингэж алга болсон.
     *
     * ⚠️ `Send Cards`-д ХЭРЭГГҮЙ — алдааны гаралт тусад нь бий.
     */
    if (o.name !== 'Send Cards' && o.alwaysOutputData === undefined) {
      o.alwaysOutputData = true;
    }
  }
  nodes.push(o);
  return o;
};

/* ══════════════════ 1. WEBHOOK VERIFY (GET) ══════════════════ */
add({
  parameters: { path: WEBHOOK_PATH, responseMode: 'responseNode', options: {} },
  id: 'btv_verify_webhook',
  name: 'FB Verify (GET)',
  type: 'n8n-nodes-base.webhook',
  typeVersion: 2,
  position: [-200, 60],
  webhookId: 'besttv-fb-verify',
});

add({
  parameters: {
    respondWith: 'text',
    /* ⚠️ Verify token hardcode — Meta тохиргоонд ЯГ энэ утгыг бичнэ */
    responseBody: `={{ $json.query['hub.verify_token'] === '${VERIFY_TOKEN}' ? $json.query['hub.challenge'] : '' }}`,
    options: {},
  },
  id: 'btv_respond_challenge',
  name: 'Respond Challenge',
  type: 'n8n-nodes-base.respondToWebhook',
  typeVersion: 1,
  position: [20, 60],
});

/* ══════════════════ 2. МЕССЕЖ ХҮЛЭЭН АВАХ (POST) ══════════════════ */
add({
  parameters: { httpMethod: 'POST', path: WEBHOOK_PATH, options: {} },
  id: 'btv_msg_webhook',
  name: 'FB Message (POST)',
  type: 'n8n-nodes-base.webhook',
  typeVersion: 2,
  position: [-200, 320],
  webhookId: 'besttv-fb-message',
});

/* ─── Route: мессеж үү, сэтгэгдэл үү? ─── */
add({
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [
        {
          id: 'is_message',
          /* ⚠️ `messaging` байвал Messenger, `changes` байвал сэтгэгдэл.
             Хоёулаа байх тохиолдол Meta-д БАЙХГҮЙ. */
          leftValue: '={{ $json.body?.entry?.[0]?.messaging ? true : false }}',
          rightValue: '',
          operator: { type: 'boolean', operation: 'true', singleValue: true },
        },
      ],
      combinator: 'and',
    },
    looseTypeValidation: true,
    options: {},
  },
  id: 'btv_route',
  name: 'Route',
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position: [-90, 320],
});

/* ─── Parse: FB/IG мессеж задлах, dedup, platform ялгах ─── */
add({
  parameters: {
    jsCode: `// BestTV — FB/IG webhook-оос мессеж/postback задлах.
// FB:  body.object === 'page',       entry[].messaging[]
// IG:  body.object === 'instagram',  entry[].messaging[]
const body = $input.first().json.body;

// ⚠️ DEDUP — FB нэг мессежийг 2 удаа (retry) илгээдэг. mid-ийг санана.
var _sd = $getWorkflowStaticData('global');
_sd.seenMids = _sd.seenMids || [];
function _dup(mid){ if(!mid)return false; if(_sd.seenMids.indexOf(mid)!==-1)return true; _sd.seenMids.push(mid); if(_sd.seenMids.length>200)_sd.seenMids=_sd.seenMids.slice(-200); return false; }

// ⚠️ Comment event (changes) Messenger salaa руу ОРОХГҮЙ
{ const e0=(body&&body.entry&&body.entry[0])||{}; if(e0.changes && !e0.messaging) return []; }
if (!body) return [];

let platform = '';
if (body.object === 'page') platform = 'facebook';
else if (body.object === 'instagram') platform = 'instagram';
else return [];

// Get Started / Ice Breaker payload → текст асуулт
const PAYLOAD_TO_TEXT = {
  GET_STARTED: '__GET_STARTED__',
  IB_MOVIES: 'шинэ кино',
  IB_SERIES: 'цуврал',
  IB_PRICING: 'багцын үнэ',
  IB_HOWTO: 'яаж үзэх вэ',
};

const out = [];
for (const entry of (body.entry || [])) {
  for (const msg of (entry.messaging || [])) {
    const psid = String(msg.sender && msg.sender.id || '');
    if (!psid) continue;
    // Өөрийн Page/IG-ээс ирсэн бол алгасна (давталтаас сэргийлнэ)
    if (psid === '${PAGE_ID}' || psid === '${IG_ID}') continue;

    if (msg.postback && msg.postback.payload) {
      const mapped = PAYLOAD_TO_TEXT[msg.postback.payload];
      const text = mapped || String(msg.postback.title || msg.postback.payload).trim();
      out.push({ json: { psid, text, isPostback: true, platform } });
      continue;
    }
    if (msg.message && msg.message.mid && _dup(msg.message.mid)) continue;
    if (msg.message && !msg.message.is_echo && msg.message.text) {
      out.push({ json: { psid, text: String(msg.message.text).trim(), isPostback: false, platform } });
      continue;
    }

    /**
     * ⚠️⚠️ ЗУРАГ / ФАЙЛ / СТИКЕР — өмнө нь БҮРЭН ЧИМЭЭГҮЙ алгасагддаг байв.
     *
     * BestTV-д дансаар шилжүүлсэн БАРИМТЫН ЗУРАГ илгээх нь бодит
     * хэрэглээ. Хариу огт өгөхгүй бол хэрэглэгч «бот үхсэн» гэж
     * бодож орхино — мөнгө төлсөн хүн хариу хүлээхгүй байх нь ноцтой.
     *
     * ⚠️ Стикер/лайкийг ялгана — тэдэнд «баримт хүлээж авлаа» гэвэл
     * утгагүй. Стикерт огт хариу өгөхгүй (спам болно).
     */
    if (msg.message && !msg.message.is_echo && !msg.message.text) {
      var atts = msg.message.attachments || [];
      var isSticker = false;
      var kind = '';
      for (var ai = 0; ai < atts.length; ai++) {
        var ty = atts[ai].type || '';
        if (ty === 'image' && atts[ai].payload && atts[ai].payload.sticker_id) isSticker = true;
        if (!kind && (ty === 'image' || ty === 'file' || ty === 'video')) kind = ty;
      }
      if (isSticker || !kind) continue;
      /* ⚠️ URL-ыг ДАМЖУУЛНА — backend R2 руу хуулж мөнхжүүлнэ.
         Meta-гийн CDN линк хэдэн цагийн дараа 403 болно. */
      var attUrl = '';
      for (var au = 0; au < atts.length; au++) {
        if (atts[au].payload && atts[au].payload.url) { attUrl = atts[au].payload.url; break; }
      }
      out.push({ json: { psid, text: '__ATTACHMENT__', attKind: kind, attUrl: attUrl, isPostback: false, platform } });
    }
  }
}
return out;`,
  },
  id: 'btv_parse',
  name: 'Parse',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [20, 240],
});

/* ─── Хэрэглэгчийн профайл ─── */
add({
  parameters: {
    url: `=${G}/{{ $json.psid }}?fields={{ $json.platform==='instagram' ? 'name,username,profile_pic' : 'name,first_name,profile_pic' }}&access_token=${TOKEN}`,
    options: { response: { response: { neverError: true } }, timeout: 8000 },
    method: 'GET',
  },
  id: 'btv_get_profile',
  name: 'Get User Profile',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [240, 240],
});

/* ─── Prep Context: AI-д өгөх контекст ─── */
add({
  parameters: {
    jsCode: `// BestTV — AI Agent-аас ӨМНӨ. psid/userText/firstName бэлдэнэ.
const NL = String.fromCharCode(10);
const psid = $('Parse').first().json.psid;
const userText = $('Parse').first().json.text;
const platform = $('Parse').first().json.platform || 'facebook';
const _conv = $('Get User Profile').first().json || {};
var _name = String(_conv.name || _conv.first_name || _conv.username || '').trim();
var _pic = String(_conv.profile_pic || '').trim();
const firstName = _name;
const profilePic = _pic;
const isGetStarted = (userText === '__GET_STARTED__');
const nameLine = firstName ? ('Хэрэглэгчийн нэр: ' + firstName) : '';

// ⚠️ ЗУРАГ/ФАЙЛ — AI руу явуулахгүй (зураг харж чадахгүй, утгагүй
// хариу зохионо). Оронд нь тодорхой заавар өгнө. Build Messages нь
// энэ directReply-г AI-аас ДЭЭГҮҮР ашиглана.
const attKind = $('Parse').first().json.attKind || '';
const attUrl = $('Parse').first().json.attUrl || '';
if (userText === '__ATTACHMENT__') {
  const what = attKind === 'video' ? 'Бичлэг' : (attKind === 'file' ? 'Файл' : 'Зураг');
  return [{ json: { psid, userText: '(' + what.toLowerCase() + ' илгээв)', firstName, profilePic,
    platform, isGetStarted: false, attKind, attUrl,
    directReply: what + ' хүлээж авлаа 📩' + NL + NL +
      'Хэрэв дансаар шилжүүлсэн баримт бол манай ажилтан ажлын өдрийн ' +
      '10:00–18:00 цагт шалгаж баталгаажуулна.' + NL + NL +
      'Асуух зүйл байвал бичээрэй 😊',
    agentInput: '(хэрэглэгч ' + what.toLowerCase() + ' илгээв)' } }];
}

// ⚠️ Холбоо барих/багцын асуултад AI зохиодог тул deterministic хариу
// бэлдэнэ (Build Messages түүнийг AI-аас ДЭЭГҮҮР ашиглана).
const lower = (userText || '').toLowerCase();
const contactTriggers = ['утас','дугаар','хаяг','холбоо','холбогд','имэйл','мэйл',
  'байршил','ажлын цаг','социал','фэйсбүүк','facebook','instagram','инстаграм',
  'бидний тухай','танай тухай','хэн бэ','хаягтай','утастай','phone','contact'];
const _hasEmailAddr = /[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}/i.test(userText || '');
const needsContact = !_hasEmailAddr && contactTriggers.some((t) => lower.includes(t));

let directReply = '';
if (needsContact) {
  try {
    const s = await this.helpers.httpRequest({
      method: 'GET', url: '${API}/settings/socials', json: true, timeout: 4000,
      /* ⚠️ throttle-ыг тойрно — 30 хүсэлтээс 10 нь 429 болдог байв,
         тэгэхэд directReply хоосон үлдэж AI холбоо барихыг ЗОХИОНО */
      headers: { 'x-bot-secret': '${BOT_SECRET}' },
    });
    const parts = ['📺 BestTV — Монголын кино, цувралын онлайн сан', ''];
    if (s && s.phone) parts.push('📞 Утас: ' + s.phone);
    if (s && s.email) parts.push('✉️ Имэйл: ' + s.email);
    if (s && s.facebook) parts.push('💬 Facebook: ' + s.facebook);
    if (s && s.instagram) parts.push('📷 Instagram: ' + s.instagram);
    parts.push('', '🌐 Вэб: ${SITE}');
    directReply = parts.join(NL);
  } catch (e) { directReply = ''; }
}

// ⚠️ БАГЦЫН ҮНЭ — AI үнэ зохиовол хэрэглэгч төөрөлдөнө. Бодит үнийг татна.
const priceTriggers = ['багц','үнэ','төлбөр','хэд вэ','ханш','тариф','захиалга','subscribe','price'];
const needsPricing = priceTriggers.some((t) => lower.includes(t));
let plansText = '';
if (needsPricing) {
  try {
    const plans = await this.helpers.httpRequest({
      method: 'GET', url: '${API}/plans', json: true, timeout: 4000,
      /* ⚠️ throttle → 429 → AI ҮНЭ ЗОХИОНО. Яг сэргийлэх гэсэн зүйл. */
      headers: { 'x-bot-secret': '${BOT_SECRET}' },
    });
    if (Array.isArray(plans) && plans.length) {
      const fmt = function(n){ var s=String(Math.round(Number(n)||0)),o='',c=0;
        for(var i=s.length-1;i>=0;i--){o=s[i]+o;c++;if(c%3===0&&i>0)o=','+o;} return o+'₮'; };
      const lines = ['📦 BestTV-ийн багцууд:', ''];
      plans.forEach(function(p){
        lines.push('• ' + p.name + ' — ' + fmt(p.price) + ' / ' + p.durationDays + ' хоног');
        if (p.description) lines.push('  ' + p.description);
      });
      lines.push('', '👉 Багц авах: ${SITE}/pricing');
      plansText = lines.join(NL);
    }
  } catch (e) { plansText = ''; }
}
if (plansText) directReply = plansText;

const agentInput = (nameLine ? (nameLine + NL) : '') + (isGetStarted
  ? '(Хэрэглэгч дөнгөж чат эхлүүллээ — дулаанаар угтаж, BestTV юу санал болгодгийг товч танилцуул)'
  : userText);

return [{ json: { psid, userText, firstName, profilePic, platform, isGetStarted, directReply, agentInput } }];`,
  },
  id: 'btv_prep',
  name: 'Prep Context',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [460, 240],
});

/* ─── Handoff шалгах: админ гар аргаар авсан уу? ─── */
add({
  parameters: {
    url: `=${API}/chat/state?sessionId={{ $json.psid }}`,
    sendHeaders: true,
    headerParameters: { parameters: [{ name: 'x-bot-secret', value: BOT_SECRET }] },
    options: { response: { response: { neverError: true } }, timeout: 5000 },
    method: 'GET',
  },
  id: 'btv_check_state',
  name: 'Check Handoff',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [560, 340],
});

add({
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [
        {
          id: 'ai_on',
          leftValue: '={{ $json.handedOff }}',
          rightValue: '',
          operator: { type: 'boolean', operation: 'false', singleValue: true },
        },
      ],
      combinator: 'and',
    },
    looseTypeValidation: true,
    options: {},
  },
  id: 'btv_ai_enabled',
  name: 'AI асаалттай юу?',
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position: [620, 240],
});

/* ⚠️ Админ авсан бол хэрэглэгчийн мессежийг ХАДГАЛААД зогсоно —
   эс бөгөөс админ юу асуусныг нь хэзээ ч харахгүй */
add({
  parameters: {
    method: 'POST',
    url: `${API}/chat/ingest`,
    sendHeaders: true,
    headerParameters: { parameters: [{ name: 'x-bot-secret', value: BOT_SECRET }] },
    sendBody: true,
    specifyBody: 'json',
    jsonBody:
      "={{ JSON.stringify({ channel: $('Prep Context').first().json.platform === 'instagram' ? 'instagram' : 'facebook', sessionId: $('Prep Context').first().json.psid, userText: $('Prep Context').first().json.userText, userName: $('Prep Context').first().json.firstName, userImage: $('Prep Context').first().json.profilePic }) }}",
    options: { response: { response: { neverError: true } }, timeout: 5000 },
  },
  id: 'btv_ingest_handoff',
  name: 'Save (админ хариулна)',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [840, 60],
});

/* ─── Typing on ─── */
const sendTo = (who) =>
  `={{ JSON.stringify({ recipient: { id: $('${who}').first().json.psid }, sender_action: 'SENDER_ACTION' }) }}`;

add({
  parameters: {
    method: 'POST',
    url: `=${G}/me/messages?access_token=${TOKEN}`,
    sendHeaders: true,
    headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
    sendBody: true,
    contentType: 'raw',
    rawContentType: 'application/json',
    body: sendTo('Prep Context').replace('SENDER_ACTION', 'typing_on'),
    options: { response: { response: { neverError: true } }, timeout: 10000 },
  },
  id: 'btv_typing_on',
  name: 'Send Typing On',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [680, 240],
});

/* ─── AI Agent ─── */
add({
  parameters: {
    promptType: 'define',
    /**
     * ⚠️⚠️ `$json` БИШ, `Prep Context`-оос ШУУД.
     *
     * AI Agent-ийн өмнөх node нь `Send Typing On` (Facebook-ийн хариу
     * буцаана) тул `$json.agentInput` нь `undefined` болж
     * «No prompt specified» алдаагаар workflow УНАНА — production
     * дээр батлагдсан (execution 2340).
     */
    text: "={{ $('Prep Context').first().json.agentInput }}",
    options: { systemMessage: fs.readFileSync(__dirname + '/system-prompt.txt', 'utf8') },
  },
  id: 'btv_agent',
  name: 'AI Agent',
  type: '@n8n/n8n-nodes-langchain.agent',
  typeVersion: 1.7,
  position: [900, 240],
  /**
   * ⚠️ OpenAI түр унах нь ЭНГИЙН зүйл (rate limit, 5xx).
   *
   * ⚠️ 5 секундын завсар — 1 секунд нь rate limit-д ХЭТ БОГИНО,
   * 3 оролдлого 3 секундэд дуусаад мөн л 429 авна.
   */
  retryOnFail: true,
  maxTries: 3,
  waitBetweenTries: 5000,
  /**
   * ⚠️⚠️ 3 удаа унасан ч урсгал ҮРГЭЛЖИЛНЭ.
   *
   * Эс бөгөөс workflow унаж, хэрэглэгч дээр `typing_on` асаалттай
   * үлдэж (~20 секунд), ямар ч хариу авахгүй — «бот үхсэн» мэт.
   * Одоо `Extract Keyword` нь `output` хоосон байхыг мэдэж,
   * `Build Messages` уучлалын мессеж бэлдэнэ.
   */
  onError: 'continueRegularOutput',
  alwaysOutputData: true,
});

add({
  parameters: {
    model: { __rl: true, value: 'gpt-4o-mini', mode: 'list', cachedResultName: 'gpt-4o-mini' },
    builtInTools: {},
    options: {},
  },
  id: 'btv_openai',
  name: 'OpenAI Chat Model',
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  typeVersion: 1.2,
  position: [840, 460],
});

add({
  parameters: {
    sessionIdType: 'customKey',
    sessionKey: "={{ 'btv_' + $('Parse').first().json.psid }}",
    tableName: 'n8n_chat_memory',
    contextWindowLength: 10,
  },
  id: 'btv_memory',
  name: 'Postgres Memory',
  type: '@n8n/n8n-nodes-langchain.memoryPostgresChat',
  typeVersion: 1.3,
  position: [1000, 460],
});

/* ─── Extract Keyword ─── */
add({
  parameters: {
    jsCode: `// AI хариунаас [SEARCH:keyword] салгана.
const prep = $('Prep Context').first().json;
const psid = prep.psid;
const platform = prep.platform || 'facebook';
let raw = ($input.first().json.output || '').trim();
let keyword = '';
const m = raw.match(/\\[SEARCH:\\s*([^\\]]*)\\]/i);
if (m) keyword = (m[1] || '').trim();
let replyText = raw.replace(/\\[SEARCH:[^\\]]*\\]/ig, '').trim();

// Markdown цэвэрлэх: [текст](url) → "текст url", ** __ устгах
function stripMd(s){ s=String(s||''); var r='',i=0;
  while(i<s.length){ if(s[i]==='['){ var c=s.indexOf('](',i);
    if(c!==-1){ var e=s.indexOf(')',c+2); if(e!==-1){ var t=s.slice(i+1,c).trim();
      var u=s.slice(c+2,e).trim(); r+=(t===u||!t)?u:(t+' '+u); i=e+1; continue; } } }
    r+=s[i]; i++; }
  r=r.split('**').join('').split('__').join('');
  var parts=r.split(' '); var out=[];
  for(var k=0;k<parts.length;k++){ if(k>0 && parts[k]!=='' && parts[k]===parts[k-1]) continue; out.push(parts[k]); }
  return out.join(' ').trim(); }
replyText = stripMd(replyText);

// ⚠️ FAQ ХАМГААЛАЛТ: AI ерөнхий үйл үгийг [SEARCH:]-д тавьсан бол хайхгүй
const kwLc = keyword.toLowerCase().replace(/\\s+/g, ' ').trim();
const FAQ_STOP = ['үзэх','яаж үзэх','хэрхэн үзэх','багц','багцын үнэ','үнэ','төлбөр',
  'төлбөр төлөх','qpay','данс','дансаар','купон','хямдрал','урамшуулал','бүртгэл',
  'бүртгүүлэх','нэвтрэх','нууц үг','имэйл','төхөөрөмж','хэдэн төхөөрөмж','татах',
  'татаж авах','офлайн','чанар','интернэт','тусламж','холбоо барих','админ'];
if (FAQ_STOP.indexOf(kwLc) !== -1) keyword = '';

// ⚠️⚠️ ТӨРӨЛ ТАНИХ — «цуврал» гэдэг нь ОЛОН АНГИТ кино (SERIES).
//
// Өмнө нь «цуврал», «кино» хоёрыг FAQ_STOP-д хийж хайлтыг бүрмөсөн
// зогсоодог байв → чатбот өмнөх ярианы үлдэгдэл харуулж, хэрэглэгч
// «цуврал» гэж асуухад ЖИРИЙН КИНО санал болгодог байв (бодит гомдол).
//
// Одоо: төрлийг ТАНЬЖ type параметрээр backend-д дамжуулна.
// Хайх үг үлдээгүй ч type байвал backend тухайн төрлийн шинэ
// кинонуудыг буцаана.
var SERIES_WORDS = ['цуврал','олон ангит','олон ангийн','сериал','series','драм цуврал'];
var MOVIE_WORDS  = ['кино','уран сайхны','бүрэн хэмжээний','movie','film'];
var titleType = '';
for (var si = 0; si < SERIES_WORDS.length; si++) {
  if (kwLc.indexOf(SERIES_WORDS[si]) !== -1) { titleType = 'SERIES'; break; }
}
if (!titleType) {
  for (var mi = 0; mi < MOVIE_WORDS.length; mi++) {
    if (kwLc === MOVIE_WORDS[mi]) { titleType = 'MOVIE'; break; }
  }
}
/* Төрлийн үгийг түлхүүрээс хасна — «солонгос цуврал» → «солонгос» */
if (titleType) {
  var strip = titleType === 'SERIES' ? SERIES_WORDS : MOVIE_WORDS;
  var cleaned = kwLc;
  for (var ci = 0; ci < strip.length; ci++) cleaned = cleaned.split(strip[ci]).join(' ');
  keyword = cleaned.replace(/\\s+/g, ' ').trim();
}

/* ⚠️ Төрөл мэдэгдэж байвал түлхүүр үг хоосон ч ХАЙНА */
const doSearch = keyword.length >= 2 || titleType !== '';

// ⚠️⚠️ AI УНАСАН ТОХИОЛДОЛ (OpenAI 3 удаа алдсан).
//
// AI Agent-д onError: continueRegularOutput тавьсан тул урсгал
// үргэлжилнэ, гэхдээ output хоосон ирнэ. Ийм үед «Уучлаарай,
// дахин бичнэ үү» гэвэл хэрэглэгч буруугаа гэж бодно — үнэнийг
// хэлж, дахин оролдохыг урина.
if (!replyText) {
  replyText = doSearch
    ? 'Хайж байна...'
    : 'Уучлаарай, түр саатал гарлаа 🙏 Хэдхэн секундын дараа дахин бичээрэй.';
}
return [{ json: { psid, keyword, titleType, doSearch, replyText, platform } }];`,
  },
  id: 'btv_extract',
  name: 'Extract Keyword',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [1120, 240],
});

/* ─── Кино хайх ─── */
add({
  parameters: {
    /**
     * ⚠️ BestTV-д GET ?q= (DigitalGer нь POST /ai/search байсан).
     *
     * ⚠️⚠️ `$json` БИШ, `Extract Keyword`-ээс ШУУД. Хооронд нь IF node
     * (`Хайх уу?`) орсон тул `$json` найдваргүй — AI Agent дээр яг
     * ийм шалтгаанаар «No prompt specified» алдаа гарсан.
     */
    url: `=${API}/titles/search?q={{ encodeURIComponent($('Extract Keyword').first().json.keyword || '') }}&type={{ $('Extract Keyword').first().json.titleType || '' }}&limit=10`,
    sendHeaders: true,
    headerParameters: { parameters: [{ name: 'x-bot-secret', value: BOT_SECRET }] },
    options: { response: { response: { neverError: true } }, timeout: 10000 },
    method: 'GET',
  },
  id: 'btv_search',
  name: 'Search Titles',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [1340, 240],
  /**
   * ⚠️⚠️ ЭНЭ ТОХИРГООГҮЙ БОЛ ЧАТБОТ ЧИМЭЭГҮЙ ЗОГСОНО.
   *
   * `/titles/search` нь олдохгүй үед ХООСОН МАССИВ `[]` буцаана.
   * n8n HTTP node массив хариуг ITEM болгон задалдаг тул `[]` →
   * **0 item** → дараагийн node (`Build Messages`) ОГТ ЭХЛЭХГҮЙ,
   * execution `running`-д мөнхөрч хэрэглэгч хариу авахгүй.
   *
   * ⚠️ Production тестээр батлагдсан: 50 мессежээс хайлт олдоогүй
   * 20 нь бүрэн алга болж, зөвхөн 30 хариулагдсан (4 удаа давтав).
   *
   * `alwaysOutputData` нь хоосон үед НЭГ хоосон item гаргана —
   * урсгал үргэлжилж, `Build Messages` «олдсонгүй» мессеж бэлдэнэ.
   */
  alwaysOutputData: true,
});

/* ─── Build Messages ─── */
add({
  parameters: {
    jsCode: `// Текст + carousel карт угсарна (FB ба IG хоёуланд).
const NL = String.fromCharCode(10);
const ex = $('Extract Keyword').first().json;
const psid = ex.psid;

// ⚠️ platform-ийг Parse-ээс ШУУД (AI гинжээр алдагддаг)
let platform = ex.platform;
if (platform !== 'instagram' && platform !== 'facebook') {
  try { platform = $('Parse').first().json.platform; } catch (e) {}
}
if (platform !== 'instagram' && platform !== 'facebook') platform = 'facebook';

// deterministic хариу (утас/багцын үнэ) нь AI-аас ДЭЭГҮҮР
let _directReply = '';
try { _directReply = ($('Prep Context').first().json.directReply || '').trim(); } catch (e) {}
let replyText = _directReply || (ex.replyText || '').trim();

// ⚠️⚠️ .all() — .first() БИШ.
//
// BestTV /titles/search нь ЦЭВЭР МАССИВ буцаана (DigitalGer нь
// {products:[]} объект байсан). n8n HTTP node нь массив хариуг
// ОЛОН ITEM болгон ЗАДАЛДАГ тул .first().json нь массив биш
// ЭХНИЙ КИНО болно → Array.isArray унаж, бүх кино алга болно.
//
// ⚠️ Production дээр батлагдсан: «agent kim» хайхад API зөв
// буцаадаг атлаа чатбот «олдсонгүй» гэж хариулж байв.
let raw = [];
try {
  const items = $('Search Titles').all();
  raw = items.map(function (it) { return it.json; });
} catch (e) { raw = []; }
/* Хоосон хариунд n8n нэг хоосон item үүсгэдэг — шүүнэ */
raw = raw.filter(function (t) { return t && t.slug; });

const triedSearch = ex.doSearch === true;
const titles = triedSearch ? raw : [];
const showCards = titles.length > 0;

if (triedSearch && !showCards) {
  const kw = (ex.keyword || '').trim();
  /* ⚠️ «цуврал» гэж асуусан хүнд «кино олдсонгүй» гэвэл буруу сонсогдоно */
  const what = ex.titleType === 'SERIES' ? 'цуврал' : 'кино';
  replyText = kw
    ? ('«' + kw + '»-тэй холбоотой ' + what + ' олдсонгүй 🙁' + NL +
       'Өөр нэрээр эсвэл жүжигчний нэрээр хайгаад үзье?')
    : (what.charAt(0).toUpperCase() + what.slice(1) + ' одоогоор алга байна 🙁' + NL +
       'Бүх контентыг эндээс харна уу: ${SITE}/catalog');
}
if (replyText.length > 1900) replyText = replyText.slice(0, 1897) + '...';

const clip = function(s,m){ s=String(s||'').split(NL).join(' ').trim();
  while(s.indexOf('  ')!==-1) s=s.split('  ').join(' ');
  return s.length>m?s.slice(0,m-1).trim()+'…':s; };

const cards = titles.slice(0,10).map(function(t){
  var url = '${SITE}/movie/' + t.slug;
  var bits = [];
  if (t.year) bits.push(String(t.year));
  if (t.rating) bits.push('⭐ ' + t.rating);
  bits.push(t.type === 'SERIES' ? '📺 Цуврал' : '🎬 Кино');
  if (t.isPremium) bits.push('🔒 Багцтай');
  var head = bits.join('  ·  ');
  var room = 79 - head.length;
  var desc = room > 12 ? clip(t.description, room) : '';
  return { title: clip(t.title, 80), subtitle: desc ? clip(head+NL+desc,80) : clip(head,80),
    image_url: t.posterUrl || t.backdropUrl || '', url: url };
});

const elements = cards.map(function(c){
  var el = { title:c.title, subtitle:c.subtitle||' ',
    default_action:{type:'web_url',url:c.url,webview_height_ratio:'full'},
    buttons:[{type:'web_url',url:c.url,title:'Дэлгэрэнгүй үзэх'}] };
  if (c.image_url) el.image_url = c.image_url;
  return el; });

// IG-д карт алдвал ашиглах текст fallback
let cardFallbackText = replyText;
if (showCards) {
  let lines = [replyText, ''];
  titles.slice(0,5).forEach(function(t){
    lines.push('🎬 ' + t.title + (t.year ? (' (' + t.year + ')') : ''));
    lines.push('   ${SITE}/movie/' + t.slug);
  });
  cardFallbackText = lines.join(NL).slice(0, 1900);
}

// ── Chat хадгалах ──
const _prep2 = $('Prep Context').first().json || {};
const _ingest = {
  channel: (platform === 'instagram') ? 'instagram' : 'facebook',
  sessionId: String(psid || '').slice(0, 64),
  userText: String(_prep2.userText || '').trim(),
  userName: String(_prep2.firstName || '').trim(),
  /* ⚠️ Профайл зураг — админ хэнтэй ярьж байгаагаа НҮҮРЭЭР нь таана.
     FB URL хугацаатай тул мессеж бүрд дахин илгээж шинэчилнэ. */
  userImage: String(_prep2.profilePic || '').trim(),
  /* ⚠️ Баримтын зураг — backend R2 руу хуулж мөнхжүүлнэ. Meta-гийн
     CDN линк хэдхэн цагт үхдэг тул маргаанд нотлох баримт үлдэхгүй. */
  attachmentUrl: String(_prep2.attUrl || '').trim(),
  attachmentType: String(_prep2.attKind || '').trim(),
  assistantText: String(replyText || '').trim(),
  titles: titles.slice(0,10).map(function(t){ return { id:t.id, title:t.title, slug:t.slug,
    posterUrl:t.posterUrl||'', url:'${SITE}/movie/'+t.slug, year:t.year, rating:t.rating }; }),
};

return [{ json: { psid, replyText, hasCards: showCards, elements, platform, cardFallbackText, _ingest } }];`,
  },
  id: 'btv_build',
  name: 'Build Messages',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [1560, 240],
});

/* ─── Typing off / Send text / Cards ─── */
add({
  parameters: {
    method: 'POST',
    url: `=${G}/me/messages?access_token=${TOKEN}`,
    sendHeaders: true,
    headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
    sendBody: true,
    contentType: 'raw',
    rawContentType: 'application/json',
    body: sendTo('Build Messages').replace('SENDER_ACTION', 'typing_off'),
    options: { response: { response: { neverError: true } }, timeout: 10000 },
  },
  id: 'btv_typing_off',
  name: 'Send Typing Off',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [1780, 160],
});

add({
  parameters: {
    method: 'POST',
    url: `=${G}/me/messages?access_token=${TOKEN}`,
    sendHeaders: true,
    headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
    sendBody: true,
    contentType: 'raw',
    rawContentType: 'application/json',
    body: "={{ JSON.stringify({ recipient: { id: $('Build Messages').first().json.psid }, message: { text: $('Build Messages').first().json.replyText }, messaging_type: 'RESPONSE' }) }}",
    options: { response: { response: { neverError: true } }, timeout: 10000 },
  },
  id: 'btv_send_text',
  name: 'Send Text',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [2000, 160],
});

add({
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [
        {
          id: 'has_cards',
          leftValue: "={{ $('Build Messages').first().json.hasCards }}",
          rightValue: true,
          operator: { type: 'boolean', operation: 'true', singleValue: true },
        },
      ],
      combinator: 'and',
    },
    options: {},
  },
  id: 'btv_has_cards',
  name: 'Has Cards?',
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position: [2220, 160],
});

add({
  parameters: {
    method: 'POST',
    url: `=${G}/me/messages?access_token=${TOKEN}`,
    sendHeaders: true,
    headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
    sendBody: true,
    contentType: 'raw',
    rawContentType: 'application/json',
    body: "={{ JSON.stringify({ recipient: { id: $('Build Messages').first().json.psid }, message: { attachment: { type: 'template', payload: { template_type: 'generic', image_aspect_ratio: 'square', elements: $('Build Messages').first().json.elements } } }, messaging_type: 'RESPONSE' }) }}",
    options: { response: { response: {} }, timeout: 10000 },
  },
  id: 'btv_send_cards',
  name: 'Send Cards',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [2440, 100],
  onError: 'continueErrorOutput',
});

add({
  parameters: {
    method: 'POST',
    url: `=${G}/me/messages?access_token=${TOKEN}`,
    sendHeaders: true,
    headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
    sendBody: true,
    contentType: 'raw',
    rawContentType: 'application/json',
    /* ⚠️ Карт алдвал (ялангуяа IG) текстээр жагсаана — хэрэглэгч хоосон үлдэхгүй */
    body: "={{ JSON.stringify({ recipient: { id: $('Build Messages').first().json.psid }, message: { text: $('Build Messages').first().json.cardFallbackText }, messaging_type: 'RESPONSE' }) }}",
    options: { response: { response: { neverError: true } }, timeout: 10000 },
  },
  id: 'btv_cards_fallback',
  name: 'Send Cards Fallback',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [2660, 200],
});

add({
  parameters: {
    method: 'POST',
    url: `${API}/chat/ingest`,
    sendHeaders: true,
    headerParameters: { parameters: [{ name: 'x-bot-secret', value: BOT_SECRET }] },
    sendBody: true,
    specifyBody: 'json',
    /* ⚠️ Динамик талбарыг Code node-оор угсарч ЭНД шууд дамжуулна —
       task-runner нь body талбарыг алгасдаг алдаатай */
    jsonBody: '={{ JSON.stringify($json._ingest) }}',
    options: { response: { response: { neverError: true } }, timeout: 5000 },
  },
  id: 'btv_ingest',
  name: 'BTV Save Ingest',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [1780, 340],
});

/* ══════════════════ 3. COMMENT AUTO-REPLY ══════════════════ */
add({
  parameters: {
    jsCode: `// FB feed + IG comments сэтгэгдэл задлах.
const body=$input.first().json.body;
if(!body)return [];
// ⚠️ ID-г ШУУД hardcode — $env нь Code node-д хүрэхгүй
var IGID='${IG_ID}';
var PAGEID='${PAGE_ID}';

/**
 * ⚠️⚠️ DEDUP — Messenger салаанд байсан ч ЭНД БАЙГААГҮЙ.
 *
 * Meta нь webhook-ыг retry хийдэг. Хамгаалалтгүй бол нэг сэтгэгдэлд
 * ХОЁР удаа хариулж, ХОЁР DM илгээнэ — хэрэглэгчид спам мэт харагдана.
 * ⚠️ DigitalGer дээр ч энэ дутагдалтай (өвлөгдсөн алдаа).
 */
var _sd = $getWorkflowStaticData('global');
_sd.seenComments = _sd.seenComments || [];
function _dupC(cid){
  if(!cid) return false;
  if(_sd.seenComments.indexOf(cid)!==-1) return true;
  _sd.seenComments.push(cid);
  if(_sd.seenComments.length>200) _sd.seenComments=_sd.seenComments.slice(-200);
  return false;
}

var out=[];
for(var ei=0;ei<(body.entry||[]).length;ei++){
  var changes=(body.entry[ei].changes)||[];
  for(var ci=0;ci<changes.length;ci++){
    var ch=changes[ci];
    var v=ch.value||{};
    // FB comment (object=page, field=feed)
    if(body.object==='page' && ch.field==='feed'){
      if(v.item!=='comment'||v.verb!=='add')continue;
      var fbCid=v.comment_id; var fbFrom=v.from&&v.from.id;
      // ⚠️ Өөрийн Page-ийн сэтгэгдэлд хариулахгүй (хязгааргүй давталт)
      if(!fbCid||!fbFrom||fbFrom===PAGEID)continue;
      if(_dupC(fbCid))continue;
      out.push({json:{platform:'facebook',commentId:fbCid,postId:v.post_id||'',userId:fbFrom,cText:String(v.message||'')}});
    }
    // IG comment (object=instagram, field=comments)
    else if(body.object==='instagram' && ch.field==='comments'){
      var igCid=v.id; var igFrom=v.from&&v.from.id;
      if(!igCid||!igFrom||igFrom===IGID)continue;
      if(_dupC(igCid))continue;
      var mediaId=(v.media&&v.media.id)||'';
      out.push({json:{platform:'instagram',commentId:igCid,postId:mediaId,cText:String(v.text||''),userId:igFrom}});
    }
  }
}
return out;`,
  },
  id: 'btv_parse_comments',
  name: 'Parse Comments',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [20, 640],
});

add({
  parameters: {
    url: `=${G}/{{ $json.postId }}?fields={{ $json.platform==='instagram' ? 'caption' : 'message' }}&access_token=${TOKEN}`,
    options: { response: { response: { neverError: true } }, timeout: 8000 },
    method: 'GET',
  },
  id: 'btv_get_post',
  name: 'Get Post Text',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [240, 640],
});

add({
  parameters: {
    jsCode: `// Постын текстээс BestTV линк олж, сэтгэгдэл + DM бэлдэнэ.
var c=$('Parse Comments').first().json;
var post=$input.first().json||{};
var s=String(post.message||post.caption||'');
var NL=String.fromCharCode(10);

function findLink(s){
  s=String(s||'');
  var i=s.indexOf('besttv.us');
  if(i===-1)return '${SITE}';
  var start=i;
  if(s.substr(i-8,8).toLowerCase()==='https://')start=i-8;
  else if(s.substr(i-7,7).toLowerCase()==='http://')start=i-7;
  else if(s.substr(i-4,4).toLowerCase()==='www.')start=i-4;
  var end=start; var stops=[32,10,13,9,41,34,39];
  while(end<s.length && stops.indexOf(s.charCodeAt(end))===-1)end++;
  var url=s.slice(start,end);
  if(url.indexOf('http')!==0)url='https://'+url;
  while(url.length && '.,)'.indexOf(url.charAt(url.length-1))!==-1)url=url.slice(0,-1);
  return url;
}
var link=findLink(s);

// Линкээс төрөл + slug задлах (regex-гүй, indexOf)
function _slugAfter(s, marker){ var i=s.indexOf(marker); if(i===-1) return '';
  var rest=s.slice(i+marker.length); var end=0; var stops=[47,63,35,32,10,13,9];
  while(end<rest.length && stops.indexOf(rest.charCodeAt(end))===-1) end++;
  return rest.slice(0,end); }

var linkType='none'; var slug='';
var ms=_slugAfter(link,'besttv.us/movie/');
if(ms){ linkType='movie'; slug=ms; }

var dmText = (linkType==='none')
  ? ('Сайн байна уу! 👋'+NL+NL+'Монгол кино, цувралыг BestTV дээр үзээрэй: ${SITE}'+NL+NL+'Асуулт байвал эндээ бичээрэй 😊')
  : ('Сайн байна уу! 👋'+NL+NL+'Таны сонирхсон киног энд үзээрэй:'+NL+NL+link+NL+NL+'Асуулт байвал эндээ бичээрэй 😊');

var replyText='Танд чатаар мэдээлэл илгээлээ 📩 Дэлгэрэнгүй: '+link;
return [{json:{platform:c.platform,commentId:c.commentId,replyText:replyText,
  privCommentId:c.commentId,dmText:dmText,link:link,linkType:linkType,slug:slug}}];`,
  },
  id: 'btv_build_reply',
  name: 'Build Reply',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [460, 640],
});

add({
  parameters: {
    method: 'POST',
    url: `=${G}/{{ $json.commentId }}/{{ $json.platform==='instagram' ? 'replies' : 'comments' }}?message={{ encodeURIComponent($json.replyText) }}&access_token=${TOKEN}`,
    options: { response: { response: { neverError: true } }, timeout: 10000 },
  },
  id: 'btv_send_comment',
  name: 'Send Comment Reply',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [680, 640],
});

add({
  parameters: {
    /**
     * ⚠️⚠️ SLUG ХООСОН БАЙВАЛ `_none_` тавина.
     *
     * Пост дээр besttv.us/movie/ линк олдоогүй бол slug='' болно →
     * URL нь `/api/titles/` болж ЖАГСААЛТЫН endpoint руу орно →
     * **24 кино** буцаана (production дээр батлагдсан) → n8n тэрийг
     * 24 item болгож задална → `Send Private Reply` 24 УДАА ажиллаж
     * хэрэглэгчид СПАМ илгээнэ.
     *
     * `_none_` нь 404 буцаана, `Build DM` энгийн текст DM бэлдэнэ.
     */
    url: `=${API}/titles/{{ $('Build Reply').first().json.slug || '_none_' }}`,
    options: { response: { response: { neverError: true } }, timeout: 8000 },
    method: 'GET',
  },
  id: 'btv_dm_meta',
  name: 'Get DM Meta',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [900, 640],
});

add({
  parameters: {
    jsCode: `// Private DM бие угсарна (карт эсвэл текст).
var b=$('Build Reply').first().json;
var meta=$input.first().json||{};
var cid=b.privCommentId;
var linkType=b.linkType; var link=b.link;
var ok = meta && meta.title && linkType==='movie';
var body;
if(ok){
  var img = meta.posterUrl || meta.backdropUrl || '';
  var title = String(meta.title||'').slice(0,80);
  var bits=[];
  if(meta.year) bits.push(String(meta.year));
  if(meta.rating) bits.push('⭐ '+meta.rating);
  bits.push(meta.type==='SERIES'?'📺 Цуврал':'🎬 Кино');
  var sub = bits.join('  ·  ').slice(0,80);
  var el={title:title, subtitle:sub||' ', image_url:img,
    default_action:{type:'web_url',url:link},
    buttons:[{type:'web_url',url:link,title:'Үзэх'}]};
  body={recipient:{comment_id:cid},
    message:{attachment:{type:'template',payload:{template_type:'generic',elements:[el]}}}};
} else {
  body={recipient:{comment_id:cid},message:{text:b.dmText}};
}
return [{json:{dmBody:JSON.stringify(body)}}];`,
  },
  id: 'btv_build_dm',
  name: 'Build DM',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [1120, 640],
});

add({
  parameters: {
    method: 'POST',
    url: `=${G}/me/messages?access_token=${TOKEN}`,
    sendHeaders: true,
    headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
    sendBody: true,
    contentType: 'raw',
    rawContentType: 'application/json',
    body: "={{ $('Build DM').first().json.dmBody }}",
    options: { response: { response: { neverError: true } }, timeout: 10000 },
  },
  id: 'btv_send_dm',
  name: 'Send Private Reply',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [1340, 640],
});

/* ══════════════════ ХОЛБООСУУД ══════════════════ */
const c = (from, outs) => ({ [from]: { main: outs.map((a) => a.map((n) => ({ node: n, type: 'main', index: 0 }))) } });

const connections = Object.assign(
  {},
  c('FB Verify (GET)', [['Respond Challenge']]),
  /**
   * ⚠️⚠️ ХОЁР САЛАА ЗЭРЭГ — n8n нь салаа бүрийг ДАРААЛУУЛЖ гүйцэтгэдэг.
   *
   * Ачаалалтай үед (50 хэрэглэгч зэрэг) мессежийн салаа сэтгэгдлийн
   * салаатай холилдож, `Search Titles`-ийн дараа `Build Messages`
   * руу орохын оронд `Parse Comments` руу үсэрч, execution гацдаг
   * байв — production тестээр батлагдсан: 50-аас зөвхөн 30 хариулав.
   *
   * ⚠️ `Route` node нь webhook-ийн ЯГ дараа төрлийг ялгаж, ЗӨВХӨН
   * НЭГ салаа руу явуулна. Ингэснээр салбарууд хоорондоо огт
   * мөргөлдөхгүй.
   */
  c('FB Message (POST)', [['Route']]),
  c('Route', [['Parse'], ['Parse Comments']]),
  c('Parse', [['Get User Profile']]),
  c('Get User Profile', [['Prep Context']]),
  c('Prep Context', [['Check Handoff']]),
  c('Check Handoff', [['AI асаалттай юу?']]),
  /* true = AI хариулна, false = админ авсан → зөвхөн хадгална */
  c('AI асаалттай юу?', [['Send Typing On'], ['Save (админ хариулна)']]),
  c('Send Typing On', [['AI Agent']]),
  /**
   * ⚠️⚠️ `Хайх уу?` IF-г ХАСАВ — production дээр ЧАТБОТ ГАЦААСАН.
   *
   * IF-ийн 2 гаралт (true→Search Titles, false→Build Messages) нь
   * `Build Messages`-ийн НЭГ оролт руу нийлдэг. n8n нь бүх орох
   * салбар дуусахыг хүлээдэг тул ажиллаагүй салаа мөнхөд «дуусаагүй»
   * үлдэж, execution `running`-д гацна — хэрэглэгч typing харсаар
   * хариу авахгүй (бодит гомдол).
   *
   * ⚠️ Дэмий дуудлагыг Search Titles дотор хоосон `q`-гээр шийднэ:
   * backend хоосон хайлтад `[]` буцаадаг тул хор хөнөөлгүй.
   */
  c('Extract Keyword', [['Search Titles']]),
  c('Search Titles', [['Build Messages']]),
  c('Build Messages', [['Send Typing Off', 'BTV Save Ingest']]),
  c('Send Typing Off', [['Send Text']]),
  c('Send Text', [['Has Cards?']]),
  c('Has Cards?', [['Send Cards']]),
  c('Send Cards', [[], ['Send Cards Fallback']]),
  c('AI Agent', [['Extract Keyword']]),
  c('Parse Comments', [['Get Post Text']]),
  c('Get Post Text', [['Build Reply']]),
  c('Build Reply', [['Send Comment Reply']]),
  c('Send Comment Reply', [['Get DM Meta']]),
  c('Get DM Meta', [['Build DM']]),
  c('Build DM', [['Send Private Reply']]),
  {
    'OpenAI Chat Model': { ai_languageModel: [[{ node: 'AI Agent', type: 'ai_languageModel', index: 0 }]] },
    'Postgres Memory': { ai_memory: [[{ node: 'AI Agent', type: 'ai_memory', index: 0 }]] },
  },
);

const wf = {
  /**
   * ⚠️⚠️ ТОГТМОЛ ID — ЗААВАЛ байх ёстой.
   *
   * 1) `id` байхгүй бол import огт бүтэхгүй:
   *    «null value in column "id" ... violates not-null constraint»
   * 2) Байсан ч санамсаргүй үүсгэвэл дахин import хийх бүрд ШИНЭ
   *    workflow үүснэ (n8n import нь ШИНЭЧИЛДЭГГҮЙ). DigitalGer дээр
   *    ингэж 10 хуулбар үүсээд гараар цэвэрлэх шаардлагатай болсон.
   */
  id: 'BestTVFBChat01',
  name: 'BestTV — Facebook/Instagram чатбот',
  nodes,
  connections,
  settings: { executionOrder: 'v1' },
};

fs.writeFileSync(__dirname + '/besttv-fb-chatbot.json', JSON.stringify(wf, null, 2));
console.log('node тоо:', nodes.length);
console.log('холбоос:', Object.keys(connections).length);
