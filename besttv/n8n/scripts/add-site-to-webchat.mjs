#!/usr/bin/env node
/**
 * ВЭБ ЧАТЫН WORKFLOW-Д `site` НЭМНЭ (`BestTVWebChat01`).
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ:
 * BestFilm нээгдсэний дараа вэб чат нь `site`-ыг ОГТ мэдэхгүй байв
 * (10 node-ийн аль нь ч дурдаагүй). Үр дүнд:
 *   1. BestFilm-ийн чат BestTV-ийн АДМИН ПАНЕЛД гарна
 *   2. Кино хайхад BestTV-ийн каталогоос хайна
 *   3. Үнэ/данс асуухад BestTV-ийн багц/данс хэлнэ
 *
 * ⚠️ Тусдаа workflow ҮҮСГЭХГҮЙ («чат НЭГ эх сурвалж» дүрэм) —
 * нэг workflow, `body.site` -оор салгана. Ирээдүйд «99» гэх засвар
 * хийхэд НЭГ л газар засна.
 *
 * ⚠️ `workflow_history` БА `workflow_entity` ХОЁУЛАНД бичнэ —
 * n8n 2.x нь history-г ажиллуулдаг, entity нь зөвхөн draft.
 *
 * Хэрэглэх:
 *   node add-site-to-webchat.mjs --dry     # зөвхөн харах
 *   node add-site-to-webchat.mjs           # бичих
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const WF = 'BestTVWebChat01';
const DRY = process.argv.includes('--dry');
const SSH = ['-o', 'StrictHostKeyChecking=no', 'digitalger-vps'];

/** VPS дээр SQL ажиллуулж, гарцыг буцаана */
function sql(query, { raw = true } = {}) {
  const flags = raw ? '-t -A' : '';
  const cmd = `docker exec digitalger-n8n-postgres psql -U n8n -d n8n ${flags} -c ${JSON.stringify(query)}`;
  return execFileSync('ssh', [...SSH, cmd], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

/* ─────────────────────────────────────────────────────────────
   1. Идэвхтэй хувилбарыг унших
   ───────────────────────────────────────────────────────────── */

const versionId = sql(
  `select "activeVersionId" from workflow_entity where id='${WF}'`,
);
if (!versionId) {
  console.error(`⛔ ${WF}-ийн activeVersionId олдсонгүй`);
  process.exit(1);
}
console.log(`Идэвхтэй хувилбар: ${versionId}`);

const nodesJson = sql(
  `select nodes::text from workflow_history where "workflowId"='${WF}' and "versionId"='${versionId}'`,
);
const nodes = JSON.parse(nodesJson);
console.log(`Node: ${nodes.length}\n`);

/* ─────────────────────────────────────────────────────────────
   2. Засварууд
   ───────────────────────────────────────────────────────────── */

const SITE_HDR = "'x-site': _site";

/** `Prep`-ийн ЭХЭНД сайт тодорхойлох мөр нэмнэ */
const PREP_HEAD = `
/* ⚠️⚠️ АЛЬ САЙТ ВЭ — widget нь биедээ илгээнэ (BRAND.key).
   Хоосон/танихгүй бол \`besttv\` — BestTV-ийн зан төлөв ХЭВЭЭР. */
const _site = (String(($input.first().json.body || {}).site || '').trim() === 'bestfilm')
  ? 'bestfilm' : 'besttv';
`;

let changed = 0;
const report = [];

for (const n of nodes) {
  const p = n.parameters || {};

  /* ── a. Code node-ууд ── */
  if (typeof p.jsCode === 'string') {
    let code = p.jsCode;
    const before = code;

    if (n.name === 'Prep') {
      /* сайтын хувьсагчийг эхэнд оруулна (тайлбар мөрүүдийн дараа) */
      if (!code.includes('const _site')) {
        const anchor = 'const body = $input.first().json.body || {};';
        if (!code.includes(anchor)) {
          console.error('⛔ Prep: `const body …` олдсонгүй — бүтэц өөрчлөгдсөн');
          process.exit(1);
        }
        code = code.replace(anchor, anchor + PREP_HEAD);
      }

      /* backend руу явах БҮХ дуудлагад x-site нэмнэ */
      code = code.replace(
        /headers:\s*\{\s*'x-bot-secret':\s*'([^']+)'\s*\}/g,
        (m, sec) => `headers: { 'x-bot-secret': '${sec}', ${SITE_HDR} }`,
      );

      /* буцаах объектод site нэмнэ */
      code = code.replace(
        /return \[\{ json: \{ psid: sessionId, userText, agentInput, directReply, planTitles, needsPricing \} \}\];/,
        'return [{ json: { psid: sessionId, userText, agentInput, directReply, planTitles, needsPricing, site: _site } }];',
      );
      code = code.replace(
        /return \[\{ json: \{ psid: sessionId, userText: "", agentInput: "", empty: true, directReply: "" \} \}\];/,
        'return [{ json: { psid: sessionId, userText: "", agentInput: "", empty: true, directReply: "", site: _site } }];',
      );
    }

    if (n.name === 'Build JSON') {
      /* ⚠️ `_ingest`-д site — үүнгүйгээр чат BURUU сайтын панелд орно */
      code = code.replace(
        /_ingest: \{\s*sessionId:/,
        `_ingest: {
    /* ⚠️⚠️ АЛЬ САЙТ — backend үүгээр шүүнэ. Байхгүй бол чат
       BestTV-ийн админ панелд гарна (Prep-ээс ирнэ). */
    site: String(($('Prep').first().json.site) || 'besttv'),
    sessionId:`,
      );

      /* Build JSON доторх httpRequest (OG preview) — сайт дамжуулна */
      code = code.replace(
        /headers:\s*\{\s*'x-bot-secret':\s*'([^']+)'\s*\}/g,
        (m, sec) =>
          `headers: { 'x-bot-secret': '${sec}', 'x-site': String(($('Prep').first().json.site) || 'besttv') }`,
      );
    }

    if (code !== before) {
      n.parameters.jsCode = code;
      changed++;
      report.push([n.name, 'jsCode', before.length, code.length]);
    }
  }

  /* ── b. HTTP Request node-ууд — x-site толгой ── */
  if (typeof p.url === 'string' && p.url.includes('besttv-backend:4100')) {
    const hp = p.headerParameters?.parameters;
    if (Array.isArray(hp) && !hp.some((h) => String(h.name).toLowerCase() === 'x-site')) {
      hp.push({
        name: 'x-site',
        /* ⚠️ Prep-ээс — бүх node түүнээс уншина, НЭГ эх сурвалж */
        value: "={{ $('Prep').first().json.site || 'besttv' }}",
      });
      p.sendHeaders = true;
      changed++;
      report.push([n.name, 'x-site толгой', hp.length - 1, hp.length]);
    }
  }
}

console.log('── Засвар ──');
for (const [name, kind, a, b] of report) {
  console.log(`  ✅ ${name.padEnd(16)} ${kind.padEnd(14)} ${a} → ${b}`);
}
if (!changed) {
  console.log('  (өөрчлөлт алга — аль хэдийн зассан байна)');
  process.exit(0);
}

/* ─────────────────────────────────────────────────────────────
   3. Шалгах — JS зөв эсэх
   ───────────────────────────────────────────────────────────── */

console.log('\n── Синтакс шалгалт ──');
const tmp = path.join(os.tmpdir(), `wc-check-${Date.now()}.mjs`);
for (const n of nodes) {
  if (typeof n.parameters?.jsCode !== 'string') continue;
  if (!report.some((r) => r[0] === n.name)) continue;
  /* ⚠️ n8n Code node нь async top-level — wrap хийж шалгана */
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

/* ─────────────────────────────────────────────────────────────
   4. Бичих — history БА entity ХОЁУЛАНД
   ───────────────────────────────────────────────────────────── */

console.log('\n── Бичих ──');
const payload = JSON.stringify(nodes);
const remote = `/tmp/wc-nodes-${Date.now()}.json`;

/* ⚠️ Файлаар дамжуулна — SQL мөрөнд шигтгэвэл escape давхарлана
   (өмнөх бодит алдаа: `to_jsonb(:'code'::text)` давхар encode хийсэн) */
fs.writeFileSync(tmp, payload, 'utf8');
execFileSync('scp', ['-o', 'StrictHostKeyChecking=no', tmp, `digitalger-vps:${remote}`], {
  stdio: 'pipe',
});
fs.unlinkSync(tmp);

execFileSync('ssh', [
  ...SSH,
  `docker cp ${remote} digitalger-n8n-postgres:${remote}`,
], { stdio: 'pipe' });

const write = `
\\set nodes \`cat ${remote}\`
BEGIN;
UPDATE workflow_history SET nodes = :'nodes'::json
  WHERE "workflowId"='${WF}' AND "versionId"='${versionId}';
UPDATE workflow_entity  SET nodes = :'nodes'::json, "updatedAt" = now()
  WHERE id='${WF}';
COMMIT;
`;
fs.writeFileSync(tmp, write, 'utf8');
execFileSync('scp', ['-o', 'StrictHostKeyChecking=no', tmp, 'digitalger-vps:/tmp/wc-write.sql'], {
  stdio: 'pipe',
});
fs.unlinkSync(tmp);

const out = execFileSync('ssh', [
  ...SSH,
  'docker cp /tmp/wc-write.sql digitalger-n8n-postgres:/tmp/wc-write.sql && ' +
    'docker exec digitalger-n8n-postgres psql -U n8n -d n8n -f /tmp/wc-write.sql',
], { encoding: 'utf8' });
console.log(out.trim().split('\n').map((l) => '  ' + l).join('\n'));

/* ─────────────────────────────────────────────────────────────
   5. DB-ЭЭС ДАХИН УНШИЖ БАТЛАХ
   ───────────────────────────────────────────────────────────── */

console.log('\n── Батлах (DB-ээс дахин уншив) ──');
for (const [table, where] of [
  ['workflow_history', `"workflowId"='${WF}' and "versionId"='${versionId}'`],
  ['workflow_entity', `id='${WF}'`],
]) {
  const n = sql(
    `select count(*) from ${table}, json_array_elements(nodes) n where ${where} and n::text like '%x-site%'`,
  );
  const ok = Number(n) >= 3;
  console.log(`  ${ok ? '✅' : '⛔'} ${table.padEnd(18)} x-site агуулсан node: ${n}`);
  if (!ok) process.exitCode = 1;
}

console.log('\n⚠️ Дараагийн алхам: docker restart digitalger-n8n-worker');
