#!/usr/bin/env node
/**
 * TELEGRAM NODE БҮРД RETRY НЭМНЭ.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ (2026-09-09 аудит):
 *
 * 15 Telegram node БҮГД `retryOnFail: false` байсан. Үр дүнд:
 *   · 2026-08-30: 553 хөрвүүлэлт зэрэг унаж Telegram-ийн rate limit
 *     давсан («Too Many Requests: retry after 9») → 553 мэдэгдэл
 *     БҮРМӨСӨН алдагдсан
 *   · 2026-09-08: `EHOSTUNREACH` (сүлжээ түр тасарсан) → 8 ТӨЛБӨРИЙН
 *     мэдэгдэл алдагдсан
 *
 * Мэдэгдэл нэг л удаа явдаг тул алдвал БУЦААХ ЗАМГҮЙ. Админ төлбөр
 * орсныг мэдэхгүй, дансаар шилжүүлсэн хүн хүлээнэ.
 *
 * ТОХИРГОО:
 *   retryOnFail: true, maxTries: 3, waitBetweenTries: 5000ms
 *
 * ⚠️ 5 секунд нь Telegram-ийн `retry after 9`-д хангалтгүй мэт
 * харагдана — гэвч 3 оролдлого = 0с + 5с + 10с = 15с нийт хүлээлт,
 * ихэнх rate limit-ийг давна. Илүү урт хүлээвэл webhook timeout болно.
 *
 * ⚠️ `onError` тохируулахгүй — алдаа гарвал execution `error` төлөвтэй
 * үлдэх нь ЗӨВ (аудитад хэрэгтэй, `EXECUTIONS_DATA_SAVE_ON_ERROR=all`).
 *
 * Хэрэглэх:
 *   node add-telegram-retry.mjs --dry
 *   node add-telegram-retry.mjs
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DRY = process.argv.includes('--dry');
const SSH = ['-o', 'StrictHostKeyChecking=no', 'digitalger-vps'];

const sql = (q) =>
  execFileSync('ssh', [...SSH,
    `docker exec digitalger-n8n-postgres psql -U n8n -d n8n -t -A -c ${JSON.stringify(q)}`,
  ], { encoding: 'utf8', maxBuffer: 64e6 }).trim();

/* Идэвхтэй workflow бүрийн Telegram node-ыг ол */
const rows = sql(
  `select w.id || '|' || w.name from workflow_entity w ` +
  `where w.active = true and w.nodes::text like '%telegram%' order by w.name`,
).split('\n').filter(Boolean).map((l) => l.split('|'));

console.log(`${rows.length} workflow-д Telegram node бий\n`);
let changed = 0;

for (const [wf, label] of rows) {
  const versionId = sql(`select "activeVersionId" from workflow_entity where id='${wf}'`);
  if (!versionId) { console.error(`  ⛔ ${label}: activeVersionId алга`); process.exitCode = 1; continue; }

  const nodes = JSON.parse(sql(
    `select nodes::text from workflow_history where "workflowId"='${wf}' and "versionId"='${versionId}'`));

  const idx = nodes
    .map((n, i) => [n, i])
    .filter(([n]) => String(n.type).includes('telegram'))
    .map(([, i]) => i);

  if (!idx.length) { console.log(`  ⏭️  ${label}: Telegram node алга`); continue; }

  const todo = idx.filter((i) => nodes[i].retryOnFail !== true);
  if (!todo.length) { console.log(`  ⏭️  ${label}: ${idx.length} node аль хэдийн retry-тэй`); continue; }

  for (const i of todo) {
    nodes[i].retryOnFail = true;
    nodes[i].maxTries = 3;
    nodes[i].waitBetweenTries = 5000;
  }
  console.log(`  + ${label}: ${todo.map((i) => nodes[i].name).join(', ')}`);

  if (DRY) continue;

  /* ⚠️ `jsonb_set` бус БҮТЭН массив — олон node зэрэг өөрчлөгдөнө */
  const tmp = path.join(os.tmpdir(), `tr-${Date.now()}.json`);
  const remote = `/tmp/tr-${Date.now()}-${wf.slice(0, 6)}.json`;
  fs.writeFileSync(tmp, JSON.stringify(nodes), 'utf8');
  execFileSync('scp', ['-o', 'StrictHostKeyChecking=no', tmp, `digitalger-vps:${remote}`], { stdio: 'pipe' });
  fs.unlinkSync(tmp);
  execFileSync('ssh', [...SSH, `docker cp ${remote} digitalger-n8n-postgres:${remote}`], { stdio: 'pipe' });

  const q =
    `BEGIN; ` +
    `UPDATE workflow_history SET nodes = pg_read_file('${remote}')::json ` +
    `WHERE "workflowId"='${wf}' AND "versionId"='${versionId}'; ` +
    `UPDATE workflow_entity SET nodes = pg_read_file('${remote}')::json, "updatedAt"=now() ` +
    `WHERE id='${wf}'; COMMIT;`;
  execFileSync('ssh', [...SSH,
    `docker exec digitalger-n8n-postgres psql -U n8n -d n8n -c ${JSON.stringify(q)}`], { stdio: 'pipe' });

  /* ── DB-ээс дахин уншиж батлах (ХОЁУЛАА) ── */
  let ok = true;
  for (const table of ['workflow_history', 'workflow_entity']) {
    const where = table === 'workflow_history'
      ? `"workflowId"='${wf}' and "versionId"='${versionId}'` : `id='${wf}'`;
    const n = sql(
      `select count(*) from ${table}, json_array_elements(nodes) n ` +
      `where ${where} and n->>'type' like '%telegram%' and (n->>'retryOnFail')::boolean = true`);
    if (Number(n) !== idx.length) { console.error(`    ⛔ ${table}: ${n}/${idx.length}`); ok = false; }
  }
  if (ok) { console.log('    ✅ бичигдэж батлагдлаа'); changed++; }
  else process.exitCode = 1;
}

if (changed && !DRY) console.log(`\n⚠️ docker restart digitalger-n8n-worker digitalger-n8n`);
