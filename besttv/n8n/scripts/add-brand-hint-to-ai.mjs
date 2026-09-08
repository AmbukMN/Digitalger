#!/usr/bin/env node
/**
 * AI-Д САЙТЫН КОНТЕКСТИЙГ `agentInput`-ААР ӨГНӨ.
 *
 * ⚠️⚠️ ЯАГААД `systemMessage`-ИЙГ ХӨНДӨХГҮЙ ВЭ:
 *
 * БОДИТ АЛДАА (2026-09-08): 17,600 тэмдэгтийн промтыг n8n илэрхийлэл
 * болгосон (эхэнд `=`) тул `ExpressionExtensionError: invalid syntax`
 * гарч ЧАТ БҮХЭЛДЭЭ 500 буцааж, production унтарсан. Буцаахад 15
 * минут зарцуулсан.
 *
 * ⚠️ ХИЧЭЭЛ: `systemMessage`-ийг ХЭЗЭЭ Ч илэрхийлэл болгож болохгүй.
 *
 * ЗӨВ АРГА: хэрэглэгчийн мессежийн ӨМНӨ богино контекст мөр залгана.
 * AI нь сүүлд бичигдсэн зааврыг илүү хүчтэй гэж үздэг тул промт дахь
 * «BestTV» гэсэн ерөнхий заавраас давамгайлна. Промт ХӨНДӨГДӨХГҮЙ.
 *
 * ⚠️ BestTV-д НЭМЭЛТ мөр ОРУУЛАХГҮЙ (`_brandHint` хоосон) — одоогийн
 * зан төлөв ЯГ ХЭВЭЭР, token ч дэмий зарцуулахгүй.
 *
 * Хэрэглэх:
 *   node add-brand-hint-to-ai.mjs --dry
 *   node add-brand-hint-to-ai.mjs
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
 * ⚠️ BestFilm үед л агуулгатай. Промт нь «BestTV» гэж бичсэн тул
 * энэ мөр түүнийг ДАРНА.
 */
const HINT = [
  "const _brandHint = (BRAND.name === 'BestTV') ? '' :",
  "  ('=== ⚠️ ЧУХАЛ: ЧИ ' + BRAND.name + '-ИЙН АЖИЛТАН ===' + NL +",
  "   'Дээрх зааварт «BestTV» гэж бичсэнийг БҮГДИЙГ «' + BRAND.name + '» гэж ойлго.' + NL +",
  "   'Вэбсайт: ' + BRAND.url + '  ·  Багц: ' + BRAND.url + '/pricing  ·  Имэйл: ' + BRAND.email + NL +",
  "   '⛔ «besttv.us» гэсэн ХОЛБООС ХЭЗЭЭ Ч БҮҮ БИЧ — тэр бол ӨӨР сайт.' + NL);",
].join('\n');

for (const [wf, prep] of [
  ['BestTVWebChat01', 'Prep'],
  ['BestTVFBChat01', 'Prep Context'],
]) {
  console.log(`\n═══ ${wf} ═══`);

  const versionId = sql(`select "activeVersionId" from workflow_entity where id='${wf}'`);
  const nodes = JSON.parse(
    sql(`select nodes::text from workflow_history where "workflowId"='${wf}' and "versionId"='${versionId}'`),
  );
  const node = nodes.find((n) => n.name === prep);
  let code = node.parameters.jsCode;

  if (code.includes('_brandHint')) {
    console.log('  ⏭️  аль хэдийн зассан');
    continue;
  }
  if (!code.includes('const BRAND =')) {
    console.error('  ⛔ BRAND блок алга — эхлээд add-site-to-brand-text.mjs');
    process.exitCode = 1;
    continue;
  }

  /**
   * ⚠️ Вэб ба FB-ийн `agentInput` бүтэц ӨӨР:
   *   вэб: `const agentInput = [nameLine, '===…', userText]…;`
   *   FB : `const agentInput = isGetStarted ? [...] : [...];`
   * Тиймээс тодорхой мөрийг олохын оронд `[nameLine,` бүрийн ӨМНӨ
   * `_brandHint` залгана — хоёр хэлбэр хоёулаа хамрагдана.
   */
  const at = code.indexOf('const agentInput =');
  if (at < 0) {
    console.error('  ⛔ agentInput олдсонгүй');
    process.exitCode = 1;
    continue;
  }
  const end = code.indexOf(';', at);
  let block = code.slice(at, end + 1);
  const before = block;

  block = block.split('[nameLine,').join('[_brandHint, nameLine,');
  if (block === before) {
    console.error('  ⛔ `[nameLine,` олдсонгүй — бүтэц өөрчлөгдсөн');
    process.exitCode = 1;
    continue;
  }

  /* ⚠️ FB-ийн угтах мөрөнд ч «BestTV» hardcode байдаг */
  block = block.split('BestTV юу санал болгодгийг').join("' + BRAND.name + ' юу санал болгодгийг");

  code = code.slice(0, at) + HINT + '\n' + block + code.slice(end + 1);

  /* ── Синтакс ЗААВАЛ — эвдвэл чат бүхэлдээ унана ── */
  const t = path.join(os.tmpdir(), `bh-${Date.now()}.mjs`);
  fs.writeFileSync(t, `async function _c(){\n${code}\n}\n`, 'utf8');
  try {
    execFileSync(process.execPath, ['--check', t], { stdio: 'pipe' });
    console.log(`  ✅ синтакс зөв (${node.parameters.jsCode.length} → ${code.length})`);
  } catch (e) {
    console.error(`  ⛔ СИНТАКС: ${String(e.stderr || e).slice(0, 300)}`);
    fs.unlinkSync(t);
    process.exitCode = 1;
    continue;
  }
  fs.unlinkSync(t);

  if (DRY) {
    console.log('  (--dry — бичсэнгүй)');
    continue;
  }

  /**
   * ⚠️⚠️ `jsonb_set` + `pg_read_file` — `\set` + `cat` арга
   * ХЭРЭГЛЭХГҮЙ. Bash → JS → psql гурван давхар escape дундуур
   * `\` алга болж, psql хувьсагч тодорхойлогдохгүй байв (3 удаа
   * оролдоод бүтээгүй бодит алдаа). Энэ арга нь зөвхөн ТУХАЙН
   * node-ыг шинэчилдэг тул илүү аюулгүй ч юм.
   */
  const idx = nodes.findIndex((n) => n.name === prep);
  const tj = path.join(os.tmpdir(), `bh-${Date.now()}.json`);
  const remote = `/tmp/bh-${Date.now()}.json`;
  fs.writeFileSync(tj, JSON.stringify(code), 'utf8');
  execFileSync('scp', ['-o', 'StrictHostKeyChecking=no', tj, `digitalger-vps:${remote}`], { stdio: 'pipe' });
  fs.unlinkSync(tj);
  execFileSync('ssh', [...SSH, `docker cp ${remote} digitalger-n8n-postgres:${remote}`], { stdio: 'pipe' });

  const q =
    `BEGIN; ` +
    `UPDATE workflow_history SET nodes = jsonb_set(nodes::jsonb, '{${idx},parameters,jsCode}', pg_read_file('${remote}')::jsonb)::json ` +
    `WHERE "workflowId"='${wf}' AND "versionId"='${versionId}'; ` +
    `UPDATE workflow_entity SET nodes = jsonb_set(nodes::jsonb, '{${idx},parameters,jsCode}', pg_read_file('${remote}')::jsonb)::json, "updatedAt"=now() ` +
    `WHERE id='${wf}'; COMMIT;`;
  const out = execFileSync(
    'ssh',
    [...SSH, `docker exec digitalger-n8n-postgres psql -U n8n -d n8n -c ${JSON.stringify(q)}`],
    { encoding: 'utf8' },
  );
  console.log(`  ${out.trim().split('\n').join(' ')}`);

  /* ── DB-ээс дахин уншиж батлах (history БА entity) ── */
  for (const table of ['workflow_history', 'workflow_entity']) {
    const where =
      table === 'workflow_history'
        ? `"workflowId"='${wf}' and "versionId"='${versionId}'`
        : `id='${wf}'`;
    const ok = sql(
      `select (n->'parameters'->>'jsCode' like '%_brandHint%')::int from ${table}, json_array_elements(nodes) n where ${where} and n->>'name'='${prep}'`,
    );
    console.log(`  ${ok === '1' ? '✅' : '⛔'} ${table}`);
    if (ok !== '1') process.exitCode = 1;
  }
}

if (!DRY) {
  console.log('\n⚠️ docker restart digitalger-n8n-worker digitalger-n8n');
  console.log('⚠️ ЗААВАЛ тест: BestTV ХЭВЭЭР ажиллаж байгааг батал');
}
