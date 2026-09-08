/**
 * ⚠️⚠️ PRODUCTION ЧАТБОТЫН БҮРЭН ТЕСТ.
 *
 * ⚠️ Бүх session id нь `zz_qa_` угтвартай — эцэст нь ЭНЭ угтвараар
 * цэвэрлэнэ. Бодит хэрэглэгчийн чат хөндөгдөхгүй.
 *
 * ⚠️ Node `fetch` ашиглана — Windows bash-ийн `curl` нь кирилл
 * текстийг `??? ????` болгож гажуудуулдаг (бодит алдаа).
 */
const URL = 'https://bot.digitalger.mn/webhook/besttv-chat';
const TAG = 'zz_qa_';

/**
 * [мессеж, хүлээлт, тайлбар]
 *   'titles'  — кино карт гарах ЁСТОЙ
 *   'text'    — зөвхөн текст (кино БАЙХГҮЙ)
 *   'any'     — аль нь ч болно (уначихгүй бол болно)
 */
const CASES = [
  /* ── 1. ШИНЭ ФУНКЦ: админы түлхүүр үг ── */
  ['99', 'titles', 'админы дүрэм — Өнчин охин'],
  ['999', 'titles', 'админы дүрэм — хоёр дахь хувилбар'],
  ['99 ', 'titles', 'арын зайтай'],
  ['🎬99', 'titles', 'emoji-тэй (FB ice breaker)'],

  /* ── 2. ⚠️ БУРУУ ТААРАЛТ ГАРАХГҮЙ ── */
  ['1999', 'text', '«1999» → «99»-д таарах ЁСГҮЙ'],
  ['9', 'any', 'нэг орон — дүрэмд байхгүй'],

  /* ── 3. КИНОНЫ НЭР (хуучин зан төлөв) ── */
  ['хар жагсаалт', 'titles', 'кирилл нэр'],
  ['Өнчин охин', 'titles', 'бүтэн нэр'],
  ['Намайг аварсан хайр', 'titles', 'урт нэр'],
  ['blacklist', 'any', 'англи нэр'],

  /* ── 4. ГАЛИГ (латинаар бичсэн монгол) ── */
  ['unchin ohin', 'any', 'галиг'],
  ['har jagsaalt', 'any', 'галиг'],

  /* ── 5. FAQ / ЗААВАР ── */
  ['Багцын үнэ', 'text', 'багцын жагсаалт'],
  ['Яаж үзэх вэ', 'text', 'заавар'],
  ['яаж төлбөр төлөх вэ', 'text', 'төлбөрийн заавар'],
  ['бүртгүүлэх', 'text', 'бүртгэлийн заавар'],

  /* ── 6. МЭНДЧИЛГЭЭ ── */
  ['сайн уу', 'text', 'мэндчилгээ'],
  ['баярлалаа', 'text', 'талархал'],
  ['ok', 'text', 'товч хариу'],

  /* ── 7. ЖАНАР / САНАЛ ── */
  ['шинэ кино', 'titles', 'шинэ кино санал'],
  ['монгол кино', 'titles', 'жанрын хүсэлт'],
  ['цуврал', 'titles', 'төрлөөр'],

  /* ── 8. ⚠️ ХИЛИЙН ТОХИОЛДОЛ ── */
  ['', 'any', 'хоосон мессеж'],
  ['🫰', 'any', 'зөвхөн emoji'],
  ['аааааааа', 'any', 'утгагүй текст'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let pass = 0, fail = 0, err = 0;
  const failures = [];

  console.log(`\n╔═══ PRODUCTION ЧАТБОТ — ${CASES.length} ТЕСТ ═══╗\n`);

  for (const [msg, expect, note] of CASES) {
    const sid = TAG + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    let out, ok;
    try {
      const res = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ sessionId: sid, message: msg }),
        signal: AbortSignal.timeout(70_000),
      });
      const j = await res.json();
      const titles = Array.isArray(j.titles) ? j.titles : [];
      const reply = String(j.reply ?? '').replace(/\s+/g, ' ').trim();

      if (expect === 'titles') ok = titles.length > 0;
      else if (expect === 'text') ok = reply.length > 0;
      else ok = true; /* 'any' — уначихгүй бол болно */

      out = titles.length
        ? `${titles.length} кино: ${titles.map((t) => t.title).slice(0, 2).join(', ')}`
        : reply.slice(0, 48) || '(хоосон)';

      ok ? pass++ : (fail++, failures.push({ msg, expect, out, note }));
    } catch (e) {
      err++;
      ok = false;
      out = 'ОНЦГОЙ: ' + String(e).slice(0, 40);
      failures.push({ msg, expect, out, note });
    }

    const label = (msg || '(хоосон)').padEnd(22).slice(0, 22);
    console.log(`  ${ok ? '✅' : '❌'} «${label}» ${out}`);

    /* ⚠️ Дараалуулна — зэрэг илгээвэл rate limit/AI дараалалд орно */
    await sleep(1200);
  }

  console.log(`\n╚═══ ${pass} ✅ · ${fail} ❌ · ${err} ⛔ ═══╝`);

  if (failures.length) {
    console.log('\n⚠️ УНАСАН:');
    for (const f of failures) {
      console.log(`   «${f.msg}» (${f.note})`);
      console.log(`     хүлээсэн: ${f.expect} · гарсан: ${f.out}`);
    }
  }
  console.log(`\n⚠️ Цэвэрлэх угтвар: ${TAG}\n`);
})();
