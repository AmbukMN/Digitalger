#!/usr/bin/env node
/**
 * ⛔⛔ ЗАСВАР: СЭТГЭГДЛИЙН САЛАА БҮХЭЛДЭЭ УНАСАН.
 *
 * АЛДАА (2026-09-09 илэрсэн, миний өмнөх засвараас үүдсэн):
 *
 *   TypeError: Node 'Prep Context' hasn't been executed
 *
 * Чатботод ХОЁР ТУСДАА салаа бий:
 *
 *   Route ─┬─ Parse → Get User Profile → Prep Context → … (ЗУРВАС/DM)
 *          └─ Parse Comments → Get Post Text → Build Reply → … (СЭТГЭГДЭЛ)
 *
 * `add-site-to-brand-text.mjs` нь `Build Reply`-д
 * `$('Prep Context').first().json.site` гэж нэмсэн. Гэвч сэтгэгдлийн
 * салаа нь `Prep Context`-оор ОГТ явдаггүй → node ажиллаагүй →
 * илэрхийлэл шидэгдэж, `Build Reply` унана.
 *
 * ҮР ДАГАВАР (хэрэглэгчийн гомдол):
 *   · авто сэтгэгдлийн хариу ОГТ явахгүй
 *   · сэтгэгдлээс үүдэлтэй хувийн зурвас (Send Private Reply) ч явахгүй
 *   (Send Comment Reply нь Build Reply-ийн АРД тул гинж бүхэлдээ таслагдана)
 *
 * ЗАСВАР: `site`-ыг сэтгэгдлийн салааны ӨӨРИЙН эх сурвалжаас —
 * `Parse Comments`-ийн гаргадаг `pageId`-аас — тооцоолно. Тэр node нь
 * `Build Reply`-ийн ӨМНӨ ажилладаг тул үргэлж хүртээмжтэй.
 *
 * ⚠️ `SITE_BY_PAGE` зураглал нь `Parse` node-той ЯГ ИЖИЛ байх ёстой —
 * хоёр газарт давхардаж байгаа нь эрсдэл, гэвч n8n-д нийтлэг тогтмол
 * хуваалцах механизм байхгүй тул өөр арга алга.
 *
 * Хэрэглэх:
 *   node fix-comment-branch-site.mjs --dry
 *   node fix-comment-branch-site.mjs
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DRY = process.argv.includes('--dry');
const SSH = ['-o', 'StrictHostKeyChecking=no', 'digitalger-vps'];
const WF = 'BestTVFBChat01';
const NODE = 'Build Reply';

const sql = (q) =>
  execFileSync('ssh', [...SSH,
    `docker exec digitalger-n8n-postgres psql -U n8n -d n8n -t -A -c ${JSON.stringify(q)}`,
  ], { encoding: 'utf8', maxBuffer: 64e6 }).trim();

const versionId = sql(`select "activeVersionId" from workflow_entity where id='${WF}'`);
if (!versionId) { console.error('⛔ activeVersionId олдсонгүй'); process.exit(1); }

const nodes = JSON.parse(sql(
  `select nodes::text from workflow_history where "workflowId"='${WF}' and "versionId"='${versionId}'`));
const idx = nodes.findIndex((n) => n.name === NODE);
if (idx < 0) { console.error(`⛔ \`${NODE}\` олдсонгүй`); process.exit(1); }

let code = nodes[idx].parameters.jsCode;

/* ── Хуучин, эвдэрсэн зарлал ── */
const BAD = `const _siteBase = (String(($('Prep Context').first().json.site) || '') === 'bestfilm')
  ? 'https://bestfilm.net' : 'https://besttv.us';`;

/* ── Шинэ: сэтгэгдлийн салааны ӨӨРИЙН эх сурвалжаас ── */
const GOOD = `/**
 * ⚠️⚠️ САЙТ нь \`Parse Comments\`-ийн \`pageId\`-аас — \`Prep Context\`
 * БИШ. Сэтгэгдлийн салаа \`Prep Context\`-оор ОГТ явдаггүй тул түүнийг
 * дуудвал «hasn't been executed» алдаа гарч, авто сэтгэгдэл БА
 * хувийн зурвас ХОЁУЛАА зогсоно (2026-09-09 бодит эвдрэл).
 *
 * ⚠️ Зураглал нь \`Parse\` node-тойгоо ЯГ ИЖИЛ байх ёстой.
 */
const _SITE_BY_PAGE = {
  "108103720808038": "besttv",
  "1709865179261697": "besttv",
  "2237164766611647": "besttv",
  "17841442595556819": "besttv"
};
const _pageId = String(($('Parse Comments').first().json || {}).pageId || '');
const _site = _SITE_BY_PAGE[_pageId] || 'besttv';
const _siteBase = (_site === 'bestfilm') ? 'https://bestfilm.net' : 'https://besttv.us';`;

if (code.includes('_SITE_BY_PAGE')) {
  console.log('⏭️  аль хэдийн зассан');
  process.exit(0);
}
if (!code.includes(BAD)) {
  console.error('⛔ эвдэрсэн зарлал олдсонгүй — гараар шалга');
  process.exit(1);
}
code = code.replace(BAD, GOOD);

/* ⚠️ `Prep Context` өөр хаана ч үлдээгүй эсэхийг батал */
if (code.includes("$('Prep Context')")) {
  console.error("⛔ `$('Prep Context')` ӨӨР ГАЗАР үлдсэн:");
  for (const [i, l] of code.split('\n').entries()) {
    if (l.includes("Prep Context")) console.error(`   ${i + 1}: ${l.trim().slice(0, 90)}`);
  }
  process.exit(1);
}

/* ⚠️ Синтакс ЗААВАЛ — эвдвэл чат бүхэлдээ унана */
const tmp = path.join(os.tmpdir(), `br-${Date.now()}.mjs`);
fs.writeFileSync(tmp, `async function _c(){\n${code}\n}\n`, 'utf8');
try {
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
  console.log(`✅ синтакс зөв (${nodes[idx].parameters.jsCode.length} → ${code.length})`);
} catch (e) {
  console.error(`⛔ СИНТАКС: ${String(e.stderr || e).slice(0, 300)}`);
  fs.unlinkSync(tmp);
  process.exit(1);
}
fs.unlinkSync(tmp);

if (DRY) { console.log('(--dry — бичсэнгүй)'); process.exit(0); }

/* ⚠️ `jsonb_set` + `pg_read_file` — `\set` escape урхийг тойрно */
const tj = path.join(os.tmpdir(), `br-${Date.now()}.json`);
const remote = `/tmp/br-${Date.now()}.json`;
fs.writeFileSync(tj, JSON.stringify(code), 'utf8');
execFileSync('scp', ['-o', 'StrictHostKeyChecking=no', tj, `digitalger-vps:${remote}`], { stdio: 'pipe' });
fs.unlinkSync(tj);
execFileSync('ssh', [...SSH, `docker cp ${remote} digitalger-n8n-postgres:${remote}`], { stdio: 'pipe' });

const q =
  `BEGIN; ` +
  `UPDATE workflow_history SET nodes = jsonb_set(nodes::jsonb, '{${idx},parameters,jsCode}', pg_read_file('${remote}')::jsonb)::json ` +
  `WHERE "workflowId"='${WF}' AND "versionId"='${versionId}'; ` +
  `UPDATE workflow_entity SET nodes = jsonb_set(nodes::jsonb, '{${idx},parameters,jsCode}', pg_read_file('${remote}')::jsonb)::json, "updatedAt"=now() ` +
  `WHERE id='${WF}'; COMMIT;`;
execFileSync('ssh', [...SSH,
  `docker exec digitalger-n8n-postgres psql -U n8n -d n8n -c ${JSON.stringify(q)}`], { stdio: 'pipe' });

/* ── DB-ээс дахин уншиж батлах (ХОЁУЛАА) ── */
let ok = true;
for (const table of ['workflow_history', 'workflow_entity']) {
  const where = table === 'workflow_history'
    ? `"workflowId"='${WF}' and "versionId"='${versionId}'` : `id='${WF}'`;
  const v = sql(`select (n->'parameters'->>'jsCode' like '%_SITE_BY_PAGE%')::int ` +
    `from ${table}, json_array_elements(nodes) n where ${where} and n->>'name'='${NODE}'`);
  if (v !== '1') { console.error(`⛔ ${table} бичигдээгүй`); ok = false; }
}
console.log(ok ? '✅ бичигдэж батлагдлаа' : '⛔ АМЖИЛТГҮЙ');
if (!ok) process.exit(1);
console.log('\n⚠️ docker restart digitalger-n8n-worker digitalger-n8n');
