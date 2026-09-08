#!/usr/bin/env node
/**
 * ЧАТЫН DETERMINISTIC ХАРИУНЫ БРЭНДИЙГ САЙТААР САЛГАНА.
 *
 * ⚠️⚠️ ЯАГААД ЭНЭ АРГА ВЭ (систем промтыг илэрхийлэл болгохын оронд):
 *
 * БОДИТ АЛДАА (2026-09-08): `systemMessage`-ийг n8n илэрхийлэл
 * болгосон (эхэнд `=`) тул `ExpressionExtensionError: invalid syntax`
 * гарч ЧАТ БҮХЭЛДЭЭ 500 буцааж, production унтарсан. Промт дотор
 * `{`,`}` байхгүй ч n8n-ийн задлагч 17,600 тэмдэгтийн текстийг
 * илэрхийлэл гэж үзээд эвдэрсэн. Буцаахад 15 минут зарцуулсан.
 *
 * ⚠️ ХИЧЭЭЛ: `systemMessage`-ийг ХЭЗЭЭ Ч илэрхийлэл болгож болохгүй.
 *
 * ЗӨВ ШИЙДЭЛ: брэндийн нэр/домэйн нь ихэвчлэн `Prep` node доторх
 * DETERMINISTIC хариунд (багц, холбоо барих, төлбөр) бичигдсэн байдаг.
 * Тэнд `site` хувьсагч аль хэдийн байгаа тул ЖИРИЙН JS-ээр солино —
 * илэрхийллийн эрсдэлгүй.
 *
 * ⚠️ AI-ийн ЧӨЛӨӨТ хариу («Чи бол BestTV-ийн ажилтан») нь промтод
 * үлдэнэ. Түүнийг сайтаар салгах бол `agentInput`-д нэмэлт мөр
 * хавсаргах нь аюулгүй (доорх `--prefix` сонголт).
 *
 * Хэрэглэх:
 *   node add-site-to-brand-text.mjs --dry
 *   node add-site-to-brand-text.mjs
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DRY = process.argv.includes('--dry');
const SSH = ['-o', 'StrictHostKeyChecking=no', 'digitalger-vps'];

const TARGETS = [
  { wf: 'BestTVWebChat01', prep: 'Prep', label: 'Вэб чат' },
  { wf: 'BestTVFBChat01', prep: 'Prep Context', label: 'FB/IG чат' },
];

const sql = (q) => execFileSync('ssh', [...SSH,
  `docker exec digitalger-n8n-postgres psql -U n8n -d n8n -t -A -c ${JSON.stringify(q)}`,
], { encoding: 'utf8', maxBuffer: 64e6 }).trim();

/**
 * Брэндийн тогтмолуудыг `site`-аас хамаарах хувьсагч болгоно.
 *
 * ⚠️ Эдгээрийг node-ийн ЭХЭНД зарлана — доорх бүх хэрэглээ түүнийг
 * уншина. `site` хувьсагч аль хэдийн байх ЁСТОЙ (`add-site-to-*chat`
 * скриптүүд нэмсэн).
 */
const BRAND_BLOCK = (siteVar) => `
/**
 * ⚠️⚠️ БРЭНДИЙН ТОГТМОЛ — САЙТААС ХАМААРНА.
 *
 * Deterministic хариу (багц, холбоо барих, төлбөрийн заавар) нь
 * брэндийн нэр, домэйныг АГУУЛДАГ. Hardcode үлдээвэл BestFilm-ийн
 * хэрэглэгчийг besttv.us руу илгээж, ӨӨРИЙН сайтаасаа гаргана.
 */
const BRAND = (${siteVar} === 'bestfilm')
  ? { name: 'BestFilm', domain: 'bestfilm.net', url: 'https://bestfilm.net', email: 'support@bestfilm.net' }
  : { name: 'BestTV',   domain: 'besttv.us',   url: 'https://besttv.us',   email: 'support@besttv.us' };
`;

let changed = 0;

for (const { wf, prep, label } of TARGETS) {
  console.log(`\n═══ ${label} (${wf}) ═══`);

  const versionId = sql(`select "activeVersionId" from workflow_entity where id='${wf}'`);
  const nodes = JSON.parse(sql(
    `select nodes::text from workflow_history where "workflowId"='${wf}' and "versionId"='${versionId}'`));

  const node = nodes.find((n) => n.name === prep);
  if (!node?.parameters?.jsCode) {
    console.error(`  ⛔ \`${prep}\` олдсонгүй`);
    process.exitCode = 1;
    continue;
  }

  let code = node.parameters.jsCode;
  const before = code;

  if (code.includes('const BRAND =')) {
    console.log('  ⏭️  аль хэдийн зассан');
    continue;
  }

  /* ⚠️ `site` хувьсагчийн нэр node бүрд өөр — вэб: `_site`, FB: `site` */
  const siteVar = /const _site\s*=/.test(code) ? '_site'
    : /const site\s*=/.test(code) ? 'site'
    : null;
  if (!siteVar) {
    console.error('  ⛔ `site` хувьсагч олдсонгүй — эхлээд add-site-to-*chat.mjs ажиллуул');
    process.exitCode = 1;
    continue;
  }

  /* BRAND блокийг `site` зарласны ДАРАА оруулна */
  const decl = new RegExp(`const ${siteVar}\\s*=[^;]+;`);
  const m = decl.exec(code);
  if (!m) {
    console.error(`  ⛔ \`const ${siteVar} = …;\` олдсонгүй`);
    process.exitCode = 1;
    continue;
  }
  code = code.slice(0, m.index + m[0].length) + BRAND_BLOCK(siteVar) + code.slice(m.index + m[0].length);

  /**
   * ⚠️ ДАРААЛАЛ ЧУХАЛ — урт таарлыг ЭХЭЛЖ.
   * `support@besttv.us` нь `besttv.us`-ыг агуулдаг; эсрэгээр хийвэл
   * `support@' + BRAND.domain` гэсэн эвдэрсэн үлдэц үүснэ.
   */
  const before2 = code;
  code = code
    .split("'support@besttv.us'").join('BRAND.email')
    .split("'https://besttv.us/pricing'").join("(BRAND.url + '/pricing')")
    .split("'https://besttv.us/movies?genre='").join("(BRAND.url + '/movies?genre=')")
    .split("'https://besttv.us'").join('BRAND.url')
    .split("'https://besttv.us/'").join("(BRAND.url + '/')");

  /* Мөр дотор шигтгэсэн хэлбэрүүд (string дотор) */
  code = code
    .split('👉 https://besttv.us/pricing').join("👉 ' + BRAND.url + '/pricing")
    .split('Багцыг харах: https://besttv.us/pricing').join("Багцыг харах: ' + BRAND.url + '/pricing")
    .split('👉 Багц авах: https://besttv.us/pricing').join("👉 Багц авах: ' + BRAND.url + '/pricing")
    .split('🌐 Вэб: https://besttv.us').join("🌐 Вэб: ' + BRAND.url + '")
    .split('✉️ Имэйл: support@besttv.us').join("✉️ Имэйл: ' + BRAND.email + '")
    .split('📺 BestTV — Монголын кино, цувралын онлайн сан')
      .join("📺 ' + BRAND.name + ' — Монголын кино, цувралын онлайн сан")
    .split('📦 BestTV-ийн багцууд:').join("📦 ' + BRAND.name + '-ийн багцууд:");

  const leftTv = (code.match(/BestTV/g) || []).length;
  const leftDom = (code.match(/besttv\.us/g) || []).length;

  console.log(`  BRAND блок нэмэв (site хувьсагч: ${siteVar})`);
  console.log(`  урт: ${before.length} → ${code.length}`);
  console.log(`  үлдсэн: BestTV×${leftTv} besttv.us×${leftDom} (тайлбар дотор байж БОЛНО)`);

  /* ⚠️ Синтакс ЗААВАЛ — n8n-д оруулаад эвдвэл чат бүхэлдээ унана */
  const tmp = path.join(os.tmpdir(), `brand-${Date.now()}.mjs`);
  fs.writeFileSync(tmp, `async function _c(){\n${code}\n}\n`, 'utf8');
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
    console.log('  ✅ синтакс зөв');
  } catch (e) {
    console.error(`  ⛔ СИНТАКС АЛДАА: ${String(e.stderr || e).slice(0, 400)}`);
    fs.unlinkSync(tmp);
    process.exitCode = 1;
    continue;
  }
  fs.unlinkSync(tmp);

  if (DRY) { console.log('  (--dry — бичсэнгүй)'); continue; }

  node.parameters.jsCode = code;

  const t2 = path.join(os.tmpdir(), `brand-w-${Date.now()}.json`);
  const remote = `/tmp/brand-${Date.now()}.json`;
  fs.writeFileSync(t2, JSON.stringify(nodes), 'utf8');
  execFileSync('scp', ['-o','StrictHostKeyChecking=no', t2, `digitalger-vps:${remote}`], { stdio:'pipe' });
  execFileSync('ssh', [...SSH, `docker cp ${remote} digitalger-n8n-postgres:${remote}`], { stdio:'pipe' });
  const rsql = `/tmp/brand-${Date.now()}.sql`;
  /* ⚠️⚠️ `\\set` — JS template-д ХОЁР ташуу. Нэгээр бичвэл `\s` нь
     escape болж алга болж, psql хувьсагч тодорхойлогдохгүй (бодит алдаа). */
  fs.writeFileSync(t2, `\\set nodes \`cat ${remote}\`\nBEGIN;\nUPDATE workflow_history SET nodes = :'nodes'::json WHERE "workflowId"='${wf}' AND "versionId"='${versionId}';\nUPDATE workflow_entity SET nodes = :'nodes'::json, "updatedAt"=now() WHERE id='${wf}';\nCOMMIT;\n`, 'utf8');
  execFileSync('scp', ['-o','StrictHostKeyChecking=no', t2, `digitalger-vps:${rsql}`], { stdio:'pipe' });
  fs.unlinkSync(t2);
  const out = execFileSync('ssh', [...SSH,
    `docker cp ${rsql} digitalger-n8n-postgres:${rsql} && docker exec digitalger-n8n-postgres psql -U n8n -d n8n -f ${rsql}`,
  ], { encoding: 'utf8' });
  console.log(out.trim().split('\n').map((l) => '    ' + l).join('\n'));

  /* ── DB-ээс дахин уншиж батлах ── */
  for (const table of ['workflow_history', 'workflow_entity']) {
    const where = table === 'workflow_history'
      ? `"workflowId"='${wf}' and "versionId"='${versionId}'`
      : `id='${wf}'`;
    const n = sql(`select count(*) from ${table}, json_array_elements(nodes) n where ${where} and n->>'name'='${prep}' and n->'parameters'->>'jsCode' like '%const BRAND =%'`);
    console.log(`  ${n === '1' ? '✅' : '⛔'} ${table.padEnd(18)} BRAND блок: ${n}`);
    if (n !== '1') process.exitCode = 1;
  }
  changed++;
}

if (changed && !DRY) {
  console.log('\n⚠️ Дараагийн алхам: docker restart digitalger-n8n-worker digitalger-n8n');
  console.log('⚠️ ЗААВАЛ тест: BestTV-ийн чат ХЭВЭЭР ажиллаж байгааг батал');
}
