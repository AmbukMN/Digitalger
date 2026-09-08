#!/usr/bin/env node
/**
 * TELEGRAM МЭДЭГДЭЛД САЙТЫН НЭР НЭМНЭ (5 workflow).
 *
 * ⚠️⚠️ АСУУДАЛ (аудитаар илэрсэн): backend нь `site`/`siteName`-ыг
 * webhook payload бүрд ЗӨВ илгээдэг (`n8n.service.ts:167-171`) атал
 * **идэвхтэй 5 workflow-ийн НЭГ Ч НЬ `body.siteName`-ыг уншдаггүй**.
 *
 * Үр дүнд:
 *   · BestFilm-ийн төлбөр «💰 Төлбөр орлоо» гэж ямар ч тэмдэглэгээгүй
 *   · Өдрийн тайлан ХОЁУЛАА «📊 BestTV — 2026-09-07» гэсэн ижил
 *     гарчигтай ирнэ (`BestTV` нь АМЬД кодод hardcode) — админ аль нь
 *     алийг ялгах БОЛОМЖГҮЙ
 *   · Дансаар шилжүүлэх мэдэгдэл аль сайтын аль данс руу орсныг
 *     хэлэхгүй — мөнгөтэй холбоотой тул хамгийн эрсдэлтэй
 *
 * ⚠️ Telegram суваг НЭГ хэвээр (`chatId=1587161751`) — сайт салгах
 * шаардлагагүй, зөвхөн мессежид нэр нэмэхэд хангалттай.
 *
 * ⚠️ `siteName` нь payload-д БАЙХГҮЙ байж болно (хуучин n8n
 * гүйцэтгэл, эсвэл гараар туршсан) → `'BestTV'` fallback (одоогийн
 * зан төлөв ХЭВЭЭР).
 *
 * Хэрэглэх:
 *   node add-site-to-alerts.mjs --dry
 *   node add-site-to-alerts.mjs
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DRY = process.argv.includes('--dry');
const SSH = ['-o', 'StrictHostKeyChecking=no', 'digitalger-vps'];

const sql = (q) =>
  execFileSync(
    'ssh',
    [...SSH, `docker exec digitalger-n8n-postgres psql -U n8n -d n8n -t -A -c ${JSON.stringify(q)}`],
    { encoding: 'utf8', maxBuffer: 64e6 },
  ).trim();

/**
 * Workflow бүрийн толгойн мөрийг сайтын нэртэй болгоно.
 *
 * ⚠️ `_site` тогтмолыг мессеж угсрахаас ӨМНӨ зарлана.
 */
const TARGETS = [
  {
    wf: 'mNWQ8v8Gke3weygF',
    label: 'Өдрийн тайлан',
    node: 'Build Message',
    /* ⚠️ HARDCODE «BestTV» — хамгийн ноцтой */
    from: `const lines = ['<b>📊 BestTV — ' + esc(b.date) + '</b>', ''];`,
    to: `const lines = ['<b>📊 ' + esc(_site) + ' — ' + esc(b.date) + '</b>', ''];`,
  },
  {
    wf: 'hBHBchdGOi4IlmBn',
    label: 'Төлбөр орлоо',
    node: 'Build Message',
    from: `'<b>💰 Төлбөр орлоо</b>\\n\\n' +`,
    to: `'<b>💰 Төлбөр орлоо · ' + esc(_site) + '</b>\\n\\n' +`,
  },
  {
    wf: 'grFaqVTvbvqfOkOB',
    label: 'Дансаар шилжүүлэв',
    node: 'Build Message',
    from: `'<b>🏦 ДАНСААР ШИЛЖҮҮЛЭВ — шалгана уу</b>\\n\\n' +`,
    to: `'<b>🏦 ДАНСААР ШИЛЖҮҮЛЭВ · ' + esc(_site) + ' — шалгана уу</b>\\n\\n' +`,
  },
  {
    wf: 'CeTvQMbq74RJvyMn',
    label: 'Хөрвүүлэлт унасан',
    node: 'Build Message',
    from: `'<b>⚠️ Хөрвүүлэлт амжилтгүй</b>\\n\\n' +`,
    to: `'<b>⚠️ Хөрвүүлэлт амжилтгүй · ' + esc(_site) + '</b>\\n\\n' +`,
  },
  {
    wf: 'vgmojkCHeoKvcJC6',
    label: 'Системийн анхааруулга',
    node: 'Build Message',
    from: `  icon + ' <b>' + esc(b.title) + '</b>\\n\\n' +`,
    to: `  icon + ' <b>' + esc(b.title) + ' · ' + esc(_site) + '</b>\\n\\n' +`,
  },
];

/** `_site` зарлалыг `esc` функцийн ДАРАА оруулна */
const DECL = `
/**
 * ⚠️⚠️ АЛЬ САЙТЫН МЭДЭГДЭЛ ВЭ.
 *
 * Backend нь \`site\`/\`siteName\`-ыг payload бүрд илгээдэг
 * (\`n8n.service.ts\`). Үүнгүйгээр BestFilm-ийн үйл явдал ямар ч
 * тэмдэглэгээгүй ирж, админ буруу сайт дээр шийдвэр гаргана.
 *
 * ⚠️ Хуучин гүйцэтгэлд талбар байхгүй байж болно → \`BestTV\`.
 */
const _site = b.siteName || 'BestTV';
`;

let changed = 0;

for (const t of TARGETS) {
  console.log(`\n═══ ${t.label} ═══`);

  const versionId = sql(`select "activeVersionId" from workflow_entity where id='${t.wf}'`);
  if (!versionId) {
    console.error('  ⛔ activeVersionId олдсонгүй');
    process.exitCode = 1;
    continue;
  }
  const nodes = JSON.parse(
    sql(`select nodes::text from workflow_history where "workflowId"='${t.wf}' and "versionId"='${versionId}'`),
  );
  const idx = nodes.findIndex((n) => n.name === t.node);
  if (idx < 0) {
    console.error(`  ⛔ \`${t.node}\` node олдсонгүй`);
    process.exitCode = 1;
    continue;
  }

  let code = nodes[idx].parameters.jsCode;

  if (code.includes('_site')) {
    console.log('  ⏭️  аль хэдийн зассан');
    continue;
  }
  if (!code.includes(t.from)) {
    console.error(`  ⛔ анхор олдсонгүй: ${t.from.slice(0, 60)}`);
    process.exitCode = 1;
    continue;
  }

  /* 1. Толгойн мөрийг солино */
  code = code.replace(t.from, t.to);

  /* 2. `_site` зарлалыг `esc` тодорхойлолтын дараа */
  const escLine = code.match(/^const esc = [^\n]+$/m);
  if (!escLine) {
    console.error('  ⛔ `const esc = …` олдсонгүй');
    process.exitCode = 1;
    continue;
  }
  code = code.replace(escLine[0], escLine[0] + '\n' + DECL);

  /* ⚠️ Синтакс ЗААВАЛ — эвдвэл мэдэгдэл бүхэлдээ зогсоно */
  const tmp = path.join(os.tmpdir(), `al-${Date.now()}.mjs`);
  fs.writeFileSync(tmp, `async function _c(){\n${code}\n}\n`, 'utf8');
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
    console.log(`  ✅ синтакс зөв (${nodes[idx].parameters.jsCode.length} → ${code.length})`);
  } catch (e) {
    console.error(`  ⛔ СИНТАКС: ${String(e.stderr || e).slice(0, 250)}`);
    fs.unlinkSync(tmp);
    process.exitCode = 1;
    continue;
  }
  fs.unlinkSync(tmp);

  if (DRY) {
    console.log('  (--dry — бичсэнгүй)');
    continue;
  }

  /* ⚠️ `jsonb_set` + `pg_read_file` — `\set` escape урхийг тойрно */
  const tj = path.join(os.tmpdir(), `al-${Date.now()}.json`);
  const remote = `/tmp/al-${Date.now()}-${idx}.json`;
  fs.writeFileSync(tj, JSON.stringify(code), 'utf8');
  execFileSync('scp', ['-o', 'StrictHostKeyChecking=no', tj, `digitalger-vps:${remote}`], { stdio: 'pipe' });
  fs.unlinkSync(tj);
  execFileSync('ssh', [...SSH, `docker cp ${remote} digitalger-n8n-postgres:${remote}`], { stdio: 'pipe' });

  const q =
    `BEGIN; ` +
    `UPDATE workflow_history SET nodes = jsonb_set(nodes::jsonb, '{${idx},parameters,jsCode}', pg_read_file('${remote}')::jsonb)::json ` +
    `WHERE "workflowId"='${t.wf}' AND "versionId"='${versionId}'; ` +
    `UPDATE workflow_entity SET nodes = jsonb_set(nodes::jsonb, '{${idx},parameters,jsCode}', pg_read_file('${remote}')::jsonb)::json, "updatedAt"=now() ` +
    `WHERE id='${t.wf}'; COMMIT;`;
  execFileSync('ssh', [...SSH, `docker exec digitalger-n8n-postgres psql -U n8n -d n8n -c ${JSON.stringify(q)}`], {
    stdio: 'pipe',
  });

  /* ── DB-ээс дахин уншиж батлах (history БА entity) ── */
  let ok = true;
  for (const table of ['workflow_history', 'workflow_entity']) {
    const where =
      table === 'workflow_history'
        ? `"workflowId"='${t.wf}' and "versionId"='${versionId}'`
        : `id='${t.wf}'`;
    const n = sql(
      `select (n->'parameters'->>'jsCode' like '%_site%')::int from ${table}, json_array_elements(nodes) n where ${where} and n->>'name'='${t.node}'`,
    );
    if (n !== '1') {
      console.error(`  ⛔ ${table} бичигдээгүй`);
      ok = false;
    }
  }
  if (ok) {
    console.log('  ✅ бичигдэж батлагдлаа');
    changed++;
  } else {
    process.exitCode = 1;
  }
}

if (changed && !DRY) {
  console.log('\n⚠️ docker restart digitalger-n8n-worker digitalger-n8n');
}
