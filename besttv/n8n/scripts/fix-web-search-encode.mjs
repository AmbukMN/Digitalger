#!/usr/bin/env node
/**
 * ВЭБ ЧАТЫН ХАЙЛТАД `encodeURIComponent` НЭМНЭ.
 *
 * ⚠️⚠️ ЯАГААД (2026-09-09 аудит):
 *
 * `BestTVWebChat01` / `Search Titles` нь `q=` параметрт encode
 * хийдэггүй байсан атал `BestTVFBChat01` нь зөв хийдэг:
 *
 *   WEB: q={{ $('Extract Keyword').first().json.keyword || '' }}
 *   FB:  q={{ encodeURIComponent($('Extract Keyword')...keyword || '') }}
 *
 * Үр дүн (n8n container дотор бодитоор туршсан):
 *   «кино#1»      → `#` нь fragment болж q=«кино» болж тасарна → 0 үр дүн
 *   «том & жижиг» → `&` нь query тусгаарлагч болно            → 0 үр дүн
 *   энгийн нэр    → хоёулаа 2 үр дүн (ижил)
 *
 * Өөрөөр хэлбэл `&`/`#`/`+` агуулсан киноны нэрийг вэб чатаар хайхад
 * «олдсонгүй 🙁» гэж хариулж, ЯГ ТЭР нэрийг Facebook чатаар хайхад
 * олдоно. Энэ нь «гурван суваг ЯГ ИЖИЛ ажиллана» дүрмийн зөрчил.
 *
 * ⚠️ `type` параметр нь зөвхөн `MOVIE`/`SERIES` утгатай тул encode
 * шаардлагагүй (FB-д ч encode хийгээгүй) — хөндөхгүй.
 *
 * Хэрэглэх:
 *   node fix-web-search-encode.mjs --dry
 *   node fix-web-search-encode.mjs
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DRY = process.argv.includes('--dry');
const SSH = ['-o', 'StrictHostKeyChecking=no', 'digitalger-vps'];
const WF = 'BestTVWebChat01';
const NODE = 'Search Titles';

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

const url = String(nodes[idx].parameters.url ?? '');
const BAD = `q={{ $('Extract Keyword').first().json.keyword || '' }}`;
const GOOD = `q={{ encodeURIComponent($('Extract Keyword').first().json.keyword || '') }}`;

if (url.includes(GOOD)) { console.log('⏭️  аль хэдийн зассан'); process.exit(0); }
if (!url.includes(BAD)) {
  console.error('⛔ хүлээгдсэн загвар олдсонгүй:');
  console.error('   ' + url.slice(0, 160));
  process.exit(1);
}

const next = url.replace(BAD, GOOD);
console.log(`  ${BAD}\n→ ${GOOD}`);

if (DRY) { console.log('(--dry — бичсэнгүй)'); process.exit(0); }

/* ⚠️ `jsonb_set` + `pg_read_file` — `\set` escape урхийг тойрно */
const tj = path.join(os.tmpdir(), `ws-${Date.now()}.json`);
const remote = `/tmp/ws-${Date.now()}.json`;
fs.writeFileSync(tj, JSON.stringify(next), 'utf8');
execFileSync('scp', ['-o', 'StrictHostKeyChecking=no', tj, `digitalger-vps:${remote}`], { stdio: 'pipe' });
fs.unlinkSync(tj);
execFileSync('ssh', [...SSH, `docker cp ${remote} digitalger-n8n-postgres:${remote}`], { stdio: 'pipe' });

const q =
  `BEGIN; ` +
  `UPDATE workflow_history SET nodes = jsonb_set(nodes::jsonb, '{${idx},parameters,url}', pg_read_file('${remote}')::jsonb)::json ` +
  `WHERE "workflowId"='${WF}' AND "versionId"='${versionId}'; ` +
  `UPDATE workflow_entity SET nodes = jsonb_set(nodes::jsonb, '{${idx},parameters,url}', pg_read_file('${remote}')::jsonb)::json, "updatedAt"=now() ` +
  `WHERE id='${WF}'; COMMIT;`;
execFileSync('ssh', [...SSH,
  `docker exec digitalger-n8n-postgres psql -U n8n -d n8n -c ${JSON.stringify(q)}`], { stdio: 'pipe' });

/* ── DB-ээс дахин уншиж батлах (ХОЁУЛАА) ── */
let ok = true;
for (const table of ['workflow_history', 'workflow_entity']) {
  const where = table === 'workflow_history'
    ? `"workflowId"='${WF}' and "versionId"='${versionId}'` : `id='${WF}'`;
  /* ⚠️ Загварт хашилт/хаалт олон тул `like` БИШ — энгийн `position` */
  const v = sql(`select count(*) from ${table}, json_array_elements(nodes) n ` +
    `where ${where} and n->>'name'='${NODE}' ` +
    `and position('encodeURIComponent' in n->'parameters'->>'url') > 0 ` +
    `and position('q={{ encodeURIComponent' in n->'parameters'->>'url') > 0`);
  if (v !== '1') { console.error(`⛔ ${table}: ${v}`); ok = false; }
}
console.log(ok ? '✅ бичигдэж батлагдлаа' : '⛔ АМЖИЛТГҮЙ');
if (!ok) process.exit(1);
console.log('\n⚠️ docker restart digitalger-n8n-worker digitalger-n8n');
