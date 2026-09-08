#!/usr/bin/env node
/**
 * AI-ИЙН СИСТЕМ ПРОМТЫГ САЙТААР САЛГАНА (вэб + FB/IG хоёулаа).
 *
 * ⚠️⚠️ АСУУДАЛ: промт дотор «BestTV» 10 удаа, «besttv.us» 10 удаа
 * HARDCODE бичигдсэн. BestFilm-ийн хуудсаар бичсэн хэрэглэгчид
 * чатбот өөрийгөө «BestTV-ийн ажилтан» гэж танилцуулж, багц авахад
 * `https://besttv.us/pricing` руу, дэмжлэгт `support@besttv.us` руу
 * илгээнэ — өөрөөр хэлбэл ӨРСӨЛДӨГЧ сайт руугаа хэрэглэгчээ явуулна.
 *
 * ⚠️ ШИЙДЭЛ: промтыг n8n илэрхийлэл болгож (эхэнд `=`), сайтын нэр/
 * домэйныг `Prep`-ээс ирэх `site`-аар орлуулна.
 *
 * Батлагдсан: промт дотор `{`, `}` тэмдэгт ОГТ БАЙХГҮЙ (0 ширхэг)
 * тул илэрхийлэл болгоход n8n-ийн template задлагч эвдрэхгүй.
 *
 * ⚠️ ХОЁР workflow-д ижил промт байгаа (17,599 vs 17,600 тэмдэгт —
 * зөвхөн нэг мөр зөрүү). Хоёуланд нь хийнэ, эс бөгөөс вэб дээр
 * зассан зүйл FB дээр үлдэнэ («чат НЭГ эх сурвалж» дүрэм).
 *
 * Хэрэглэх:
 *   node add-site-to-ai-prompt.mjs --dry
 *   node add-site-to-ai-prompt.mjs
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DRY = process.argv.includes('--dry');
const SSH = ['-o', 'StrictHostKeyChecking=no', 'digitalger-vps'];

/**
 * Аль workflow-д, аль node-оос `site` уншихыг заана.
 *
 * ⚠️ Вэб чатад `Prep`, FB/IG-д `Prep Context` — НЭР ӨӨР.
 */
const TARGETS = [
  { wf: 'BestTVWebChat01', prepNode: 'Prep', label: 'Вэб чат' },
  { wf: 'BestTVFBChat01', prepNode: 'Prep Context', label: 'FB/IG чат' },
];

function sql(query) {
  const cmd = `docker exec digitalger-n8n-postgres psql -U n8n -d n8n -t -A -c ${JSON.stringify(query)}`;
  return execFileSync('ssh', [...SSH, cmd], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

/**
 * Промтыг сайт-мэдэгч илэрхийлэл болгоно.
 *
 * ⚠️ Орлуулалтын ДАРААЛАЛ чухал: `support@besttv.us` нь `besttv.us`-ыг
 * агуулдаг тул ЭХЭЛЖ түүнийг солино. Эсрэгээр хийвэл
 * `support@bestfilm.net` болох ёстой газар `support@` + буруу үлдэц
 * үүснэ.
 */
function siteAware(prompt, prepNode) {
  /* n8n илэрхийлэл — `Prep`-ээс site уншина, байхгүй бол besttv */
  const S = `{{ $('${prepNode}').first().json.site === 'bestfilm' ? 'BestFilm' : 'BestTV' }}`;
  const D = `{{ $('${prepNode}').first().json.site === 'bestfilm' ? 'bestfilm.net' : 'besttv.us' }}`;
  const E = `{{ $('${prepNode}').first().json.site === 'bestfilm' ? 'support@bestfilm.net' : 'support@besttv.us' }}`;

  let out = prompt;
  /* ⚠️ 1. Имэйл ЭХЭЛЖ — `besttv.us`-ыг агуулдаг тул */
  out = out.split('support@besttv.us').join(E);
  /* 2. Домэйн (протоколгүй — `https://` нь промтод үлдэнэ) */
  out = out.split('besttv.us').join(D);
  /* 3. Брэндийн нэр */
  out = out.split('BestTV').join(S);

  /* ⚠️ n8n илэрхийлэл болгох — ЭХЭНД `=` */
  return '=' + out;
}

let changed = 0;

for (const { wf, prepNode, label } of TARGETS) {
  console.log(`\n═══ ${label} (${wf}) ═══`);

  const versionId = sql(`select "activeVersionId" from workflow_entity where id='${wf}'`);
  if (!versionId) {
    console.error(`  ⛔ activeVersionId олдсонгүй`);
    process.exitCode = 1;
    continue;
  }

  const nodesJson = sql(
    `select nodes::text from workflow_history where "workflowId"='${wf}' and "versionId"='${versionId}'`,
  );
  const nodes = JSON.parse(nodesJson);

  const agent = nodes.find((n) => n.name === 'AI Agent');
  if (!agent?.parameters?.options?.systemMessage) {
    console.error(`  ⛔ AI Agent-ийн systemMessage олдсонгүй`);
    process.exitCode = 1;
    continue;
  }

  const before = agent.parameters.options.systemMessage;

  if (before.startsWith('=')) {
    console.log('  ⏭️  аль хэдийн илэрхийлэл болсон — алгаслаа');
    continue;
  }

  /* ⚠️ `Prep` node үнэхээр `site` буцаадаг эсэхийг БАТАЛНА —
     эс бөгөөс илэрхийлэл `undefined` болж, промт эвдэрнэ */
  const prep = nodes.find((n) => n.name === prepNode);
  if (!prep?.parameters?.jsCode?.includes('site')) {
    console.error(`  ⛔ \`${prepNode}\` нь \`site\` буцаадаггүй — эхлээд түүнийг зас`);
    process.exitCode = 1;
    continue;
  }

  const after = siteAware(before, prepNode);
  agent.parameters.options.systemMessage = after;

  const tvCount = (before.match(/BestTV/g) || []).length;
  const domCount = (before.match(/besttv\.us/g) || []).length;
  console.log(`  BestTV → илэрхийлэл : ${tvCount}`);
  console.log(`  besttv.us → домэйн  : ${domCount}`);
  console.log(`  урт: ${before.length} → ${after.length}`);

  /* ── Батлах: hardcode үлдээгүй эсэх ── */
  const leftover = after
    .split(prepNode).join('')          // илэрхийлэл доторх node нэр
    .replace(/\{\{[^}]*\}\}/g, '');    // илэрхийллүүдийг хасна
  const badTv = (leftover.match(/BestTV/g) || []).length;
  const badDom = (leftover.match(/besttv\.us/g) || []).length;
  if (badTv || badDom) {
    console.error(`  ⛔ hardcode ҮЛДСЭН: BestTV×${badTv} besttv.us×${badDom}`);
    process.exitCode = 1;
    continue;
  }
  console.log('  ✅ hardcode үлдээгүй');

  if (DRY) {
    console.log('  (--dry — бичсэнгүй)');
    console.log('  жишээ:', after.slice(1, 140).replace(/\n/g, ' '));
    continue;
  }

  /* ── Бичих: history БА entity ХОЁУЛАНД ── */
  const tmp = path.join(os.tmpdir(), `ai-prompt-${Date.now()}.json`);
  const remote = `/tmp/ai-nodes-${Date.now()}.json`;
  fs.writeFileSync(tmp, JSON.stringify(nodes), 'utf8');
  execFileSync('scp', ['-o', 'StrictHostKeyChecking=no', tmp, `digitalger-vps:${remote}`], { stdio: 'pipe' });
  execFileSync('ssh', [...SSH, `docker cp ${remote} digitalger-n8n-postgres:${remote}`], { stdio: 'pipe' });

  const writeSql = `
\\set nodes \`cat ${remote}\`
BEGIN;
UPDATE workflow_history SET nodes = :'nodes'::json
  WHERE "workflowId"='${wf}' AND "versionId"='${versionId}';
UPDATE workflow_entity SET nodes = :'nodes'::json, "updatedAt" = now()
  WHERE id='${wf}';
COMMIT;
`;
  fs.writeFileSync(tmp, writeSql, 'utf8');
  const rsql = `/tmp/ai-write-${Date.now()}.sql`;
  execFileSync('scp', ['-o', 'StrictHostKeyChecking=no', tmp, `digitalger-vps:${rsql}`], { stdio: 'pipe' });
  fs.unlinkSync(tmp);

  const out = execFileSync('ssh', [
    ...SSH,
    `docker cp ${rsql} digitalger-n8n-postgres:${rsql} && docker exec digitalger-n8n-postgres psql -U n8n -d n8n -f ${rsql}`,
  ], { encoding: 'utf8' });
  console.log(out.trim().split('\n').map((l) => '    ' + l).join('\n'));

  /* ── DB-ЭЭС ДАХИН УНШИЖ БАТЛАХ ── */
  for (const [table, where] of [
    ['workflow_history', `"workflowId"='${wf}' and "versionId"='${versionId}'`],
    ['workflow_entity', `id='${wf}'`],
  ]) {
    const ok = sql(
      `select left(n->'parameters'->'options'->>'systemMessage',1) from ${table}, json_array_elements(nodes) n where ${where} and n->>'name'='AI Agent'`,
    );
    console.log(`  ${ok === '=' ? '✅' : '⛔'} ${table.padEnd(18)} илэрхийлэл: ${ok === '=' ? 'тийм' : ok}`);
    if (ok !== '=') process.exitCode = 1;
  }
  changed++;
}

if (changed && !DRY) {
  console.log('\n⚠️ Дараагийн алхам: docker restart digitalger-n8n-worker digitalger-n8n');
}
