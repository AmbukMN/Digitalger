#!/usr/bin/env node
/**
 * FB/IG ЧАТЫН WORKFLOW-Д `site` НЭМНЭ (`BestTVFBChat01`).
 *
 * ⚠️⚠️ ЯАГААД: FB/IG нь `X-Site` толгой ИЛГЭЭДЭГГҮЙ (Meta-гийн сервер
 * шууд дуудна). Аль сайтынх болохыг мэдэх ЦОРЫН ГАНЦ зам нь ЗУРВАС
 * ХҮЛЭЭН АВСАН хуудасны id (`entry.id` → `pageId`).
 *
 * Үүнгүйгээр BestFilm-ийн хуудсаар бичсэн хүнд:
 *   · чат BestTV-ийн админ панелд гарна
 *   · BestTV-ийн каталогоос кино хайна
 *   · AI өөрийгөө «BestTV-ийн ажилтан» гэж танилцуулна
 *
 * ⚠️ Тусдаа workflow ҮҮСГЭХГҮЙ («чат НЭГ эх сурвалж» дүрэм) — нэг
 * workflow, `pageId → site` зураглал. «99» гэх засварыг НЭГ л газар
 * хийнэ.
 *
 * Хэрэглэх:
 *   node add-site-to-fbchat.mjs --dry
 *   node add-site-to-fbchat.mjs
 *   node add-site-to-fbchat.mjs --map=100111222333:bestfilm,100444555666:bestfilm
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const WF = 'BestTVFBChat01';
const DRY = process.argv.includes('--dry');
const SSH = ['-o', 'StrictHostKeyChecking=no', 'digitalger-vps'];

/**
 * `pageId → site` зураглал.
 *
 * ⚠️ ОДООГИЙН 4 хуудас БҮГД BestTV — тэднийг зөвхөн `besttv` гэж
 * тэмдэглэнэ (одоогийн зан төлөв ЯГ ХЭВЭЭР).
 *
 * ⚠️ BestFilm-ийн хуудас нэмэхэд `--map=<pageId>:bestfilm` өгнө,
 * эсвэл энд шууд бичнэ. Зураглалд БАЙХГҮЙ id нь `besttv` болно —
 * шинэ хуудас нэмээд мартвал BestTV-д унана (аюулгүй анхдагч).
 */
const DEFAULT_MAP = {
  '108103720808038': 'besttv', // Best TV (FB)
  '1709865179261697': 'besttv', // Богино драм (FB)
  '2237164766611647': 'besttv', // Шилдэг кинонууд (FB)
  '17841442595556819': 'besttv', // Instagram
};

const extra = (process.argv.find((a) => a.startsWith('--map=')) || '').split('=')[1];
const MAP = { ...DEFAULT_MAP };
if (extra) {
  for (const pair of extra.split(',')) {
    const [id, site] = pair.split(':');
    if (!id || !['besttv', 'bestfilm'].includes(site)) {
      console.error(`⛔ буруу зураглал: ${pair} (жишээ: 12345:bestfilm)`);
      process.exit(1);
    }
    MAP[id.trim()] = site;
  }
}

function sql(query) {
  const cmd = `docker exec digitalger-n8n-postgres psql -U n8n -d n8n -t -A -c ${JSON.stringify(query)}`;
  return execFileSync('ssh', [...SSH, cmd], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
}

/* ── 1. Идэвхтэй хувилбарыг унших ── */

const versionId = sql(`select "activeVersionId" from workflow_entity where id='${WF}'`);
if (!versionId) {
  console.error('⛔ activeVersionId олдсонгүй');
  process.exit(1);
}
const nodes = JSON.parse(
  sql(`select nodes::text from workflow_history where "workflowId"='${WF}' and "versionId"='${versionId}'`),
);
console.log(`Идэвхтэй хувилбар: ${versionId}`);
console.log(`Node: ${nodes.length}`);
console.log('\nЗураглал:');
for (const [id, s] of Object.entries(MAP)) console.log(`  ${id.padEnd(20)} → ${s}`);

/* ── 2. Засварууд ── */

/** `Prep Context`-д зураглал + `site` буцаалт */
const SITE_BLOCK = `

/**
 * ⚠️⚠️ АЛЬ САЙТЫН ХУУДАС ВЭ — FB/IG нь \`X-Site\` толгой ИЛГЭЭДЭГГҮЙ.
 *
 * Аль сайтынх болохыг мэдэх ЦОРЫН ГАНЦ зам нь зурвас хүлээн авсан
 * хуудасны id. Үүнгүйгээр BestFilm-ийн чат BestTV-ийн админ панелд
 * орж, BestTV-ийн каталогоос кино хайна.
 *
 * ⚠️ Зураглалд БАЙХГҮЙ id → \`besttv\` (аюулгүй анхдагч — шинэ хуудас
 * нэмээд энд бичихээ мартвал одоогийн зан төлөв хэвээр үлдэнэ).
 */
const SITE_BY_PAGE = ${JSON.stringify(MAP, null, 2).split('\n').join('\n')};
const site = SITE_BY_PAGE[pageId] || 'besttv';
`;

let changed = 0;
const report = [];

for (const n of nodes) {
  const p = n.parameters || {};

  /* ── a. Prep Context — зураглал + буцаалт ── */
  if (n.name === 'Prep Context' && typeof p.jsCode === 'string') {
    let code = p.jsCode;
    const before = code;

    if (!code.includes('SITE_BY_PAGE')) {
      const anchor = "const pageId = String($('Parse').first().json.pageId || '');";
      if (!code.includes(anchor)) {
        console.error('⛔ Prep Context: `const pageId …` олдсонгүй — бүтэц өөрчлөгдсөн');
        process.exit(1);
      }
      code = code.replace(anchor, anchor + SITE_BLOCK);
    }

    /* Буцаалтад `site` нэмнэ — 2 газар (хоосон салаа ба үндсэн) */
    code = code.replace(
      /return \[\{ json: \{ psid, pageId, userText, firstName, profilePic, platform, isGetStarted, directReply, agentInput \} \}\];/,
      'return [{ json: { psid, pageId, site, userText, firstName, profilePic, platform, isGetStarted, directReply, agentInput } }];',
    );
    code = code.replace(
      /return \[\{ json: \{ psid, userText: '\(' \+ what\.toLowerCase\(\) \+ ' илгээв\)', firstName, profilePic,/,
      "return [{ json: { psid, pageId, site, userText: '(' + what.toLowerCase() + ' илгээв)', firstName, profilePic,",
    );

    if (code !== before) {
      n.parameters.jsCode = code;
      changed++;
      report.push(['Prep Context', 'jsCode', before.length, code.length]);
    }
  }

  /* ── b. Build Messages — `_ingest`-д site ── */
  if (n.name === 'Build Messages' && typeof p.jsCode === 'string') {
    let code = p.jsCode;
    const before = code;

    if (!code.includes('site:')) {
      code = code.replace(
        /const _ingest = \{\s*channel:/,
        `const _ingest = {
  /* ⚠️⚠️ АЛЬ САЙТ — backend үүгээр шүүнэ (\`Prep Context\`-ээс).
     Үүнгүйгээр BestFilm-ийн чат BestTV-ийн панелд гарна. */
  site: String(($('Prep Context').first().json.site) || 'besttv'),
  channel:`,
      );
    }

    if (code !== before) {
      n.parameters.jsCode = code;
      changed++;
      report.push(['Build Messages', 'jsCode', before.length, code.length]);
    }
  }

  /* ── c. Backend рүү явах HTTP node-ууд — x-site толгой ── */
  if (typeof p.url === 'string' && p.url.includes('besttv-backend:4100')) {
    const hp = p.headerParameters?.parameters;
    if (Array.isArray(hp) && !hp.some((h) => String(h.name).toLowerCase() === 'x-site')) {
      hp.push({
        name: 'x-site',
        value: "={{ $('Prep Context').first().json.site || 'besttv' }}",
      });
      p.sendHeaders = true;
      changed++;
      report.push([n.name, 'x-site толгой', hp.length - 1, hp.length]);
    }
  }
}

console.log('\n── Засвар ──');
for (const [name, kind, a, b] of report) {
  console.log(`  ✅ ${name.padEnd(18)} ${kind.padEnd(14)} ${a} → ${b}`);
}
if (!changed) {
  console.log('  (өөрчлөлт алга — аль хэдийн зассан)');
  process.exit(0);
}

/* ── 3. Синтакс шалгах ── */

console.log('\n── Синтакс шалгалт ──');
const tmp = path.join(os.tmpdir(), `fb-check-${Date.now()}.mjs`);
for (const n of nodes) {
  if (typeof n.parameters?.jsCode !== 'string') continue;
  if (!report.some((r) => r[0] === n.name && r[1] === 'jsCode')) continue;
  /* ⚠️ n8n Code node нь top-level await ашигладаг — async wrap */
  fs.writeFileSync(tmp, `async function _c(){\n${n.parameters.jsCode}\n}\n`, 'utf8');
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
    console.log(`  ✅ ${n.name}`);
  } catch (e) {
    console.error(`  ⛔ ${n.name}: ${String(e.stderr || e).slice(0, 300)}`);
    fs.unlinkSync(tmp);
    process.exit(1);
  }
}
fs.existsSync(tmp) && fs.unlinkSync(tmp);

if (DRY) {
  console.log('\n(--dry — бичсэнгүй)');
  process.exit(0);
}

/* ── 4. Бичих — history БА entity ── */

console.log('\n── Бичих ──');
const remote = `/tmp/fb-nodes-${Date.now()}.json`;
fs.writeFileSync(tmp, JSON.stringify(nodes), 'utf8');
execFileSync('scp', ['-o', 'StrictHostKeyChecking=no', tmp, `digitalger-vps:${remote}`], { stdio: 'pipe' });
execFileSync('ssh', [...SSH, `docker cp ${remote} digitalger-n8n-postgres:${remote}`], { stdio: 'pipe' });

const rsql = `/tmp/fb-write-${Date.now()}.sql`;
fs.writeFileSync(tmp, `
\\set nodes \`cat ${remote}\`
BEGIN;
UPDATE workflow_history SET nodes = :'nodes'::json
  WHERE "workflowId"='${WF}' AND "versionId"='${versionId}';
UPDATE workflow_entity SET nodes = :'nodes'::json, "updatedAt" = now()
  WHERE id='${WF}';
COMMIT;
`, 'utf8');
execFileSync('scp', ['-o', 'StrictHostKeyChecking=no', tmp, `digitalger-vps:${rsql}`], { stdio: 'pipe' });
fs.unlinkSync(tmp);

const out = execFileSync('ssh', [
  ...SSH,
  `docker cp ${rsql} digitalger-n8n-postgres:${rsql} && docker exec digitalger-n8n-postgres psql -U n8n -d n8n -f ${rsql}`,
], { encoding: 'utf8' });
console.log(out.trim().split('\n').map((l) => '  ' + l).join('\n'));

/* ── 5. DB-ЭЭС ДАХИН УНШИЖ БАТЛАХ ── */

console.log('\n── Батлах ──');
for (const [table, where] of [
  ['workflow_history', `"workflowId"='${WF}' and "versionId"='${versionId}'`],
  ['workflow_entity', `id='${WF}'`],
]) {
  const n = sql(
    `select count(*) from ${table}, json_array_elements(nodes) n where ${where} and n::text like '%SITE_BY_PAGE%'`,
  );
  const x = sql(
    `select count(*) from ${table}, json_array_elements(nodes) n where ${where} and n::text like '%x-site%'`,
  );
  const ok = Number(n) >= 1 && Number(x) >= 3;
  console.log(`  ${ok ? '✅' : '⛔'} ${table.padEnd(18)} зураглал:${n} x-site:${x}`);
  if (!ok) process.exitCode = 1;
}

console.log('\n⚠️ Дараагийн алхам:');
console.log('   1. docker restart digitalger-n8n-worker digitalger-n8n');
console.log('   2. node add-site-to-ai-prompt.mjs   (AI промтыг сайтаар салгана)');
