#!/usr/bin/env node
/**
 * TELEGRAM МЭДЭГДЛИЙГ САЙТААР ТУСДАА СУВАГ РУУ САЛГАНА.
 *
 * ⚠️⚠️ BestTV-ийн урсгал ОГТ ХӨНДӨГДӨХГҮЙ — `chatId` нь илэрхийлэл
 * болох ба `site !== 'bestfilm'` үед ХУУЧИН утгаа буцаана.
 *
 * ⚠️ Шинэ node НЭМЭХГҮЙ, Switch ч хэрэггүй — Telegram node-ийн
 * `chatId` талбарыг илэрхийлэл болгоход хангалттай:
 *
 *     ={{ $json.body.site === 'bestfilm' ? '<BF>' : '<TV>' }}
 *
 * ⚠️ `site` талбар байхгүй бол (хуучин гүйцэтгэл, гараар турших)
 * BestTV руу очно — одоогийн зан төлөв ХЭВЭЭР.
 *
 * ⚠️⚠️ `$json.body.site` — `Build Message` node нь `{ message }` л
 * буцаадаг тул webhook-ийн биеийг ШУУД унших ёстой. Node бүрийн
 * өмнөх алхмаас хамаарч зам өөр байж болох тул скрипт нь тухайн
 * workflow-ийн `Build Message` дотор `b.siteName` хаанаас ирж
 * байгааг үндэслэн ЗӨВ замыг сонгоно.
 *
 * Хэрэглэх:
 *   node split-telegram-chat.mjs --bestfilm=-1001234567890 --dry
 *   node split-telegram-chat.mjs --bestfilm=-1001234567890
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DRY = process.argv.includes('--dry');
const SSH = ['-o', 'StrictHostKeyChecking=no', 'digitalger-vps'];

const BF = (process.argv.find((a) => a.startsWith('--bestfilm=')) || '').split('=')[1];
if (!BF) {
  console.error('⛔ --bestfilm=<chat id> заавал. Жишээ: --bestfilm=-1001234567890');
  console.error('   ID авах заавар: besttv/n8n/workflows/bestfilm-telegram-setup.md');
  process.exit(1);
}
if (!/^-?\d{6,20}$/.test(BF)) {
  console.error(`⛔ Буруу chat id: ${BF} (Групп нь ихэвчлэн -100… гэж эхэлдэг)`);
  process.exit(1);
}

const sql = (q) =>
  execFileSync(
    'ssh',
    [...SSH, `docker exec digitalger-n8n-postgres psql -U n8n -d n8n -t -A -c ${JSON.stringify(q)}`],
    { encoding: 'utf8', maxBuffer: 64e6 },
  ).trim();

const WORKFLOWS = [
  ['mNWQ8v8Gke3weygF', 'Өдрийн тайлан'],
  ['hBHBchdGOi4IlmBn', 'Төлбөр орлоо'],
  ['grFaqVTvbvqfOkOB', 'Дансаар шилжүүлэв'],
  ['CeTvQMbq74RJvyMn', 'Хөрвүүлэлт унасан'],
  ['vgmojkCHeoKvcJC6', 'Системийн анхааруулга'],
];

console.log(`\nBestFilm суваг: ${BF}\n`);
let changed = 0;

for (const [wf, label] of WORKFLOWS) {
  console.log(`═══ ${label} ═══`);

  const versionId = sql(`select "activeVersionId" from workflow_entity where id='${wf}'`);
  const nodes = JSON.parse(
    sql(`select nodes::text from workflow_history where "workflowId"='${wf}' and "versionId"='${versionId}'`),
  );

  const idx = nodes.findIndex((n) => String(n.type).includes('telegram'));
  if (idx < 0) {
    console.error('  ⛔ Telegram node олдсонгүй');
    process.exitCode = 1;
    continue;
  }
  const node = nodes[idx];
  const cur = String(node.parameters?.chatId ?? '');

  if (cur.startsWith('=')) {
    console.log(`  ⏭️  аль хэдийн илэрхийлэл: ${cur.slice(0, 70)}`);
    continue;
  }
  if (!/^\d{6,20}$/.test(cur)) {
    console.error(`  ⛔ chatId буруу хэлбэртэй: «${cur}»`);
    process.exitCode = 1;
    continue;
  }

  /**
   * ⚠️ Webhook node-ийн нэрийг олно — `$('<нэр>')`-ээр биеийг уншина.
   *
   * Telegram node нь `Build Message`-ийн ард байдаг ба тэр нь зөвхөн
   * `{ message }` буцаадаг тул `$json.body` АЛГА. Webhook node-оос
   * шууд уншина.
   */
  const hook = nodes.find((n) => String(n.type).includes('webhook'));
  if (!hook) {
    console.error('  ⛔ Webhook node олдсонгүй');
    process.exitCode = 1;
    continue;
  }

  const expr =
    `={{ $('${hook.name}').first().json.body.site === 'bestfilm' ? '${BF}' : '${cur}' }}`;

  console.log(`  BestTV: ${cur}  →  илэрхийлэл (webhook: «${hook.name}»)`);

  if (DRY) {
    console.log(`  (--dry) ${expr.slice(0, 100)}`);
    continue;
  }

  node.parameters.chatId = expr;

  /* ⚠️ `jsonb_set` + `pg_read_file` — `\set` escape урхийг тойрно */
  const tj = path.join(os.tmpdir(), `tg-${Date.now()}.json`);
  const remote = `/tmp/tg-${Date.now()}-${idx}.json`;
  fs.writeFileSync(tj, JSON.stringify(expr), 'utf8');
  execFileSync('scp', ['-o', 'StrictHostKeyChecking=no', tj, `digitalger-vps:${remote}`], { stdio: 'pipe' });
  fs.unlinkSync(tj);
  execFileSync('ssh', [...SSH, `docker cp ${remote} digitalger-n8n-postgres:${remote}`], { stdio: 'pipe' });

  const q =
    `BEGIN; ` +
    `UPDATE workflow_history SET nodes = jsonb_set(nodes::jsonb, '{${idx},parameters,chatId}', pg_read_file('${remote}')::jsonb)::json ` +
    `WHERE "workflowId"='${wf}' AND "versionId"='${versionId}'; ` +
    `UPDATE workflow_entity SET nodes = jsonb_set(nodes::jsonb, '{${idx},parameters,chatId}', pg_read_file('${remote}')::jsonb)::json, "updatedAt"=now() ` +
    `WHERE id='${wf}'; COMMIT;`;
  execFileSync('ssh', [...SSH, `docker exec digitalger-n8n-postgres psql -U n8n -d n8n -c ${JSON.stringify(q)}`], {
    stdio: 'pipe',
  });

  /* ── DB-ээс дахин уншиж батлах ── */
  let ok = true;
  for (const table of ['workflow_history', 'workflow_entity']) {
    const where =
      table === 'workflow_history'
        ? `"workflowId"='${wf}' and "versionId"='${versionId}'`
        : `id='${wf}'`;
    const v = sql(
      `select (n->'parameters'->>'chatId' like '=%')::int from ${table}, json_array_elements(nodes) n where ${where} and n->>'type' like '%telegram%'`,
    );
    if (v !== '1') {
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
  console.log(`\n⚠️ docker restart digitalger-n8n-worker digitalger-n8n`);
  console.log(`⚠️ ЗААВАЛ ТЕСТ: хоёр сайтын мэдэгдэл ТУСДАА чат руу очиж байгааг батал`);
}
