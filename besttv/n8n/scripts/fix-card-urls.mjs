#!/usr/bin/env node
/**
 * ЧАТЫН КАРТЫН ХОЛБООСЫГ САЙТААР ЗАСНА.
 *
 * ⚠️⚠️ БОДИТ АЛДАА (E2E тестээр илэрсэн): BestFilm-ийн чатад гарсан
 * киноны карт нь `https://besttv.us/movie/<slug>` руу заадаг байв.
 * Хэрэглэгч картаа дарвал ӨӨР САЙТ руу шилжинэ — BestFilm-ийн
 * хэрэглэгч BestTV дээр очиж, тэндээ бүртгүүлж, төлбөрөө тэнд төлнө.
 *
 * Энэ нь брэндийн текстээс ч ноцтой: текст нь зүгээр нэг буруу нэр,
 * харин холбоос нь ХЭРЭГЛЭГЧИЙГ БОДИТООР алдуулна.
 *
 * ⚠️ 3 node-д байна: `Build JSON` (вэб), `Build Messages`, `Build Reply`
 * (FB/IG). Нэгийг нь мартвал тэр суваг чимээгүй эвдэрнэ.
 *
 * Хэрэглэх:
 *   node fix-card-urls.mjs --dry
 *   node fix-card-urls.mjs
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
 * Аль workflow-ийн аль node-ыг, аль `Prep`-ээс сайт уншихыг заана.
 *
 * ⚠️ Вэб чатын `Build JSON` нь `$('Prep')`, FB нь `$('Prep Context')`.
 */
const TARGETS = [
  { wf: 'BestTVWebChat01', prep: 'Prep', nodes: ['Build JSON'] },
  { wf: 'BestTVFBChat01', prep: 'Prep Context', nodes: ['Build Messages', 'Build Reply'] },
];

let changed = 0;

for (const { wf, prep, nodes: names } of TARGETS) {
  console.log(`\n═══ ${wf} ═══`);

  const versionId = sql(`select "activeVersionId" from workflow_entity where id='${wf}'`);
  const nodes = JSON.parse(
    sql(`select nodes::text from workflow_history where "workflowId"='${wf}' and "versionId"='${versionId}'`),
  );

  for (const name of names) {
    const node = nodes.find((n) => n.name === name);
    if (!node?.parameters?.jsCode) {
      console.error(`  ⛔ ${name}: олдсонгүй`);
      process.exitCode = 1;
      continue;
    }

    let code = node.parameters.jsCode;
    const before = code;

    if (code.includes('_siteBase')) {
      console.log(`  ⏭️  ${name}: аль хэдийн зассан`);
      continue;
    }

    /**
     * ⚠️ Сайтын үндсэн хаягийг ЭХЭНД зарлана.
     *
     * `Prep`-ээс `site` уншина — тэр node аль хэдийн буцаадаг
     * (`add-site-to-*chat.mjs` нэмсэн). Байхгүй бол `besttv`
     * (одоогийн зан төлөв хэвээр).
     */
    const decl =
      `/**\n` +
      ` * ⚠️⚠️ КАРТЫН ХОЛБООСЫН ҮНДЭС — САЙТААС ХАМААРНА.\n` +
      ` *\n` +
      ` * Hardcode \`besttv.us\` байсан тул BestFilm-ийн чатад гарсан\n` +
      ` * карт дарахад хэрэглэгч ӨӨР САЙТ руу шилждэг байв.\n` +
      ` */\n` +
      `const _siteBase = (String(($('${prep}').first().json.site) || '') === 'bestfilm')\n` +
      `  ? 'https://bestfilm.net' : 'https://besttv.us';\n`;

    /**
     * ⚠️⚠️ ЗАРЛАЛЫГ ОРЛУУЛАЛТЫН ДАРАА нэмнэ.
     *
     * БОДИТ АЛДАА: зарлалыг эхэнд нэмээд дараа нь домэйн орлуулбал
     * орлуулалт ЗАРЛАЛЫН ӨӨРИЙНХ нь `'https://besttv.us'`-ыг ч
     * солиод `: _siteBase + ''` болгодог →
     * `Cannot access '_siteBase' before initialization` → чат унана.
     *
     * Тиймээс: эхлээд БИЕИЙГ орлуулж, ДАРАА нь зарлалыг урд нь тавина.
     */

    /**
     * ⚠️ Бүх бичих хэлбэрийг хамруулна. Бодит кодод дор хаяж 4 хэлбэр
     * олдсон (E2E тестээр илэрсэн):
     *   'https://besttv.us/movie/' + t.slug      ← хоосон зайтай
     *   'https://besttv.us/movie/'+t.slug        ← хоосон зайгүй
     *   '   https://besttv.us/movie/' + t.slug   ← мөр доторх
     *   '…: https://besttv.us/catalog'           ← өөр зам
     *
     * Тиймээс ЗАМ бүрийг тусад нь биш, ДОМЭЙНЫГ бүхэлд нь солино.
     */
    code = code
      /* Тэмдэгт мөр нь домэйнээр ЭХЭЛСЭН — бүхэлд нь орлуулна */
      .split("'https://besttv.us").join("_siteBase + '")
      .split('"https://besttv.us').join('_siteBase + "');

    /**
     * ⚠️ Дээрх орлуулалт `'…текст https://besttv.us/x'` гэсэн МӨР
     * ДОТОРХ хэлбэрийг эвдэнэ (тэмдэгт мөр дундуур тасарна). Тиймээс
     * тэдгээрийг тусад нь — домэйныг хаагаад залгана.
     */
    code = code.replace(
      /'([^'\n]*?)https:\/\/besttv\.us([^'\n]*)'/g,
      (_m, pre, post) => `'${pre}' + _siteBase + '${post}'`,
    );

    /* ⚠️ Зарлалыг ЭНД нэмнэ — орлуулалт түүнийг хөндөхгүй */
    code = decl + code;

    const leftover = (code.match(/https:\/\/besttv\.us/g) || []).length;
    /* ⚠️ Зарлал дотор 1 удаа гарна (`: 'https://besttv.us'`) — тэр ЗӨВ */
    if (leftover > 1) {
      console.error(`  ⛔ ${name}: ${leftover - 1} холбоос ҮЛДСЭН — гараар шалга`);
      process.exitCode = 1;
      continue;
    }

    /* ⚠️ Синтакс ЗААВАЛ — эвдвэл чат бүхэлдээ унана */
    const t = path.join(os.tmpdir(), `cu-${Date.now()}.mjs`);
    fs.writeFileSync(t, `async function _c(){\n${code}\n}\n`, 'utf8');
    try {
      execFileSync(process.execPath, ['--check', t], { stdio: 'pipe' });
    } catch (e) {
      console.error(`  ⛔ ${name}: СИНТАКС ${String(e.stderr || e).slice(0, 250)}`);
      fs.unlinkSync(t);
      process.exitCode = 1;
      continue;
    }
    fs.unlinkSync(t);

    console.log(`  ✅ ${name}: ${before.length} → ${code.length} (синтакс зөв)`);

    if (DRY) continue;
    node.parameters.jsCode = code;

    /* ⚠️ `jsonb_set` + `pg_read_file` — `\set` escape урхийг тойрно */
    const idx = nodes.findIndex((n) => n.name === name);
    const tj = path.join(os.tmpdir(), `cu-${Date.now()}.json`);
    const remote = `/tmp/cu-${Date.now()}-${idx}.json`;
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
    execFileSync('ssh', [...SSH, `docker exec digitalger-n8n-postgres psql -U n8n -d n8n -c ${JSON.stringify(q)}`], {
      stdio: 'pipe',
    });

    /* ── DB-ээс дахин уншиж батлах ── */
    for (const table of ['workflow_history', 'workflow_entity']) {
      const where =
        table === 'workflow_history'
          ? `"workflowId"='${wf}' and "versionId"='${versionId}'`
          : `id='${wf}'`;
      const ok = sql(
        `select (n->'parameters'->>'jsCode' like '%_siteBase%')::int from ${table}, json_array_elements(nodes) n where ${where} and n->>'name'='${name}'`,
      );
      if (ok !== '1') {
        console.error(`     ⛔ ${table} бичигдээгүй`);
        process.exitCode = 1;
      }
    }
    console.log(`     ✅ бичигдэж батлагдлаа`);
    changed++;
  }
}

if (changed && !DRY) {
  console.log('\n⚠️ docker restart digitalger-n8n-worker digitalger-n8n');
  console.log('⚠️ ЗААВАЛ тест: картын холбоос ЗӨВ домэйнтэй эсэх');
}
