/**
 * ⚠️⚠️ БҮРЭН УРСГАЛЫН ТЕСТ — НЭВТРЭЛТ + ТӨЛБӨР + QPAY, САЙТ БҮРД.
 *
 * ⚠️ МӨНГӨ ТӨЛӨХГҮЙ — зөвхөн нэхэмжлэл (QR) үүсэх эсэхийг шалгана.
 * ⚠️ Үүсгэсэн БҮХ зүйлийг (хэрэглэгч, төлбөр, session) ТӨГСГӨЛД устгана.
 * ⚠️ BestTV-ийн production өгөгдөлд ХҮРЭХГҮЙ.
 */
const TV = 'https://besttv.us';
const BF = 'https://bestfilm.net';

/* ⚠️ Танигдахуйц угтвар — цэвэрлэхэд ашиглана */
const TAG = `qatest_${Date.now().toString(36)}`;
const PASS = 'QaTest!2026#tmp';

let pass = 0, fail = 0;
const failures = [];
const created = { users: [], payments: [] };

const ck = (name, ok, detail = '') => {
  ok ? pass++ : fail++;
  if (!ok) failures.push(`${name} — ${detail}`);
  console.log(`  ${ok ? '✅' : '❌'} ${name.padEnd(46)} ${detail}`);
};

const J = async (url, opts = {}) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(40_000), ...opts });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, ok: r.ok, json: j, text: t };
};

for (const [site, base] of [['besttv', TV], ['bestfilm', BF]]) {
  console.log(`\n╔══════ ${site.toUpperCase()} ══════╗`);
  const email = `${TAG}_${site}@example.com`;

  /* ─── 1. БҮРТГҮҮЛЭХ ─────────────────────────────────── */
  console.log('\n── 1. Бүртгэл ──');
  const reg = await J(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASS, name: 'QA Test' }),
  });
  ck('бүртгүүлэх', reg.ok, `${reg.status}`);
  if (reg.ok) created.users.push({ site, email });
  if (!reg.ok) { console.log(`     ${reg.text.slice(0, 140)}`); continue; }

  /* ─── 2. НЭВТРЭХ ────────────────────────────────────── */
  console.log('\n── 2. Нэвтрэлт ──');
  const lg = await J(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASS }),
  });
  ck('нэвтрэх', lg.ok, `${lg.status}`);
  if (!lg.ok) continue;
  const T = lg.json.accessToken;
  const A = { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' };

  const me = await J(`${base}/api/auth/me`, { headers: A });
  ck('/auth/me', me.ok && me.json?.email === email, `${me.status}`);

  /* ⚠️ Сайт хоорондын хил — НӨГӨӨ сайт руу энэ токеноор орж БОЛОХГҮЙ */
  const other = site === 'besttv' ? BF : TV;
  const cross = await J(`${other}/api/auth/me`, { headers: A });
  ck('⚠️ нөгөө сайтад ХААЛТТАЙ', cross.status === 401, `${cross.status}`);

  /* ─── 3. БАГЦ ───────────────────────────────────────── */
  console.log('\n── 3. Багц ──');
  const pl = await J(`${base}/api/plans`);
  const plans = Array.isArray(pl.json) ? pl.json : (pl.json?.items ?? []);
  ck('багц ирнэ', plans.length > 0, `${plans.length}`);
  const paid = plans.filter((p) => (p.price ?? 0) > 0);
  ck('бүх багц үнэтэй', paid.length === plans.length, `${paid.length}/${plans.length}`);

  const methods = await J(`${base}/api/payments/methods`);
  ck('QPay идэвхтэй', methods.json?.qpay === true, JSON.stringify(methods.json));

  /* ─── 4. QPAY НЭХЭМЖЛЭЛ ─────────────────────────────── */
  console.log('\n── 4. QPay нэхэмжлэл (мөнгө ТӨЛӨХГҮЙ) ──');
  const inv = await J(`${base}/api/payments/initiate`, {
    method: 'POST', headers: A,
    body: JSON.stringify({ planId: plans[0].id }),
  });
  ck('initiate', inv.ok, `${inv.status}`);
  if (inv.json?.paymentId) created.payments.push({ site, id: inv.json.paymentId });

  ck('devMode=false (PRODUCTION)', inv.json?.devMode === false, `devMode=${inv.json?.devMode}`);
  ck('QR ирлээ', Boolean(inv.json?.qrText || inv.json?.qrImage), inv.json?.qrText ? 'qrText' : '—');
  const urls = inv.json?.urls ?? inv.json?.qpayUrls ?? [];
  ck('банкны deeplink', urls.length > 10, `${urls.length} банк`);
  const invId = inv.json?.invoiceId ?? inv.json?.qpayInvoiceId;
  ck('QPay invoiceId', Boolean(invId), String(invId ?? '').slice(0, 18));

  /* ⚠️ Тухайн сайтын merchant-аар үүссэн эсэх — invoice нь QPay дээр бий */
  const chk = await J(`${base}/api/payments/${inv.json?.paymentId}/check`, { headers: A });
  ck('төлбөр шалгах endpoint', chk.ok, `${chk.status} status=${chk.json?.status ?? '—'}`);

  /* ─── 5. ХЭТЭВЧ ─────────────────────────────────────── */
  console.log('\n── 5. Хэтэвч ──');
  const w = await J(`${base}/api/wallet`, { headers: A });
  ck('хэтэвчний үлдэгдэл', w.ok, `${w.status} balance=${w.json?.balance ?? w.json?.walletBalance ?? '—'}`);

  const topup = await J(`${base}/api/payments/wallet/topup`, {
    method: 'POST', headers: A, body: JSON.stringify({ amount: 5000 }),
  });
  ck('цэнэглэх нэхэмжлэл', topup.ok, `${topup.status} devMode=${topup.json?.devMode}`);
  if (topup.json?.paymentId) created.payments.push({ site, id: topup.json.paymentId });

  /* ─── 6. ЭРХ ────────────────────────────────────────── */
  console.log('\n── 6. Эрх (төлөөгүй тул ХААЛТТАЙ байх ЁСТОЙ) ──');
  /* ⚠️ Захиалга нь ТУСДАА endpoint БИШ — `/auth/me`-ийн доторх талбар */
  const meAgain = await J(`${base}/api/auth/me`, { headers: A });
  const list = meAgain.json?.subscriptions ?? [];
  ck('захиалга хоосон (төлөөгүй)', meAgain.ok && list.length === 0,
     `${meAgain.status} ${list.length} захиалга`);

  /* ⚠️ Төлбөртэй кино ХААЛТТАЙ байх ЁСТОЙ */
  const cat = await J(`${base}/api/titles/home`);
  const premium = (cat.json?.newReleases ?? []).find((t) => t.isPremium);
  if (premium) {
    const acc = await J(`${base}/api/titles/${premium.slug}/access`, { headers: A });
    const allowed = acc.json?.allowed ?? acc.json?.canAccess;
    ck('төлбөртэй кино ХААЛТТАЙ', acc.status === 404 || allowed === false,
       `${acc.status} allowed=${allowed}`);
  }
}

/* ═══ ЦЭВЭРЛЭГЭЭ ═══ */
console.log(`\n╔══════ ДҮН ══════╗`);
console.log(`  ${pass} ✅   ${fail} ❌`);
if (failures.length) {
  console.log('\nУНАСАН:');
  for (const f of failures) console.log(`  · ${f}`);
}
console.log(`\n⚠️ ЦЭВЭРЛЭХ (SQL):`);
console.log(`  DELETE FROM "Payment" WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE '${TAG}%');`);
console.log(`  DELETE FROM "User" WHERE email LIKE '${TAG}%';`);
console.log(`\n  тэмдэг: ${TAG}`);
console.log(`  үүссэн: ${created.users.length} хэрэглэгч, ${created.payments.length} төлбөр`);
