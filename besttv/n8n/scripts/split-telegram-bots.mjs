#!/usr/bin/env node
/**
 * TELEGRAM МЭДЭГДЛИЙГ ХОЁР ӨӨР BOT РУУ САЛГАНА (5 workflow).
 *
 * ⚠️⚠️ ЯАГААД NODE НЭМЭХ ХЭРЭГТЭЙ ВЭ:
 *
 * n8n-ийн Telegram node нь НЭГ credential-тай холбогддог — тэр нь
 * илэрхийлэл БОЛОХГҮЙ. Хоёр өөр bot ашиглах ганц зам нь ХОЁР node.
 *
 * (Хэрэв нэг bot, өөр чат байсан бол `chatId`-г илэрхийлэл болгоод
 *  л хангалттай байсан. Гэвч хэрэглэгч тусдаа bot үүсгэсэн.)
 *
 * БҮТЭЦ:
 *
 *   Build Message → [IF: site==='bestfilm']
 *                      ├─ true  → Telegram BestFilm → Respond 200
 *                      └─ false → Telegram         → Respond 200
 *
 * ⚠️⚠️ BestTV-ийн урсгал ОГТ ХӨНДӨГДӨХГҮЙ: одоо байгаа `Telegram`
 * node болон түүний credential хэвээр, зөвхөн өмнө нь IF ордог.
 * `site` талбар байхгүй бол (хуучин гүйцэтгэл) `false` салаа руу
 * буюу BestTV руу очно.
 *
 * Хэрэглэх:
 *   node split-telegram-bots.mjs --chat=1587161751 --dry
 *   node split-telegram-bots.mjs --chat=1587161751
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DRY = process.argv.includes('--dry');
const SSH = ['-o', 'StrictHostKeyChecking=no', 'digitalger-vps'];

const CHAT = (process.argv.find((a) => a.startsWith('--chat=')) || '').split('=')[1];
if (!CHAT || !/^-?\d{6,20}$/.test(CHAT)) {
  console.error('⛔ --chat=<BestFilm chat id> заавал (жишээ: --chat=1587161751)');
  process.exit(1);
}

const CRED_ID = 'bestfilmTelegramCred';
const CRED_NAME = 'BestFilm Telegram Bot';

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

let changed = 0;

for (const [wf, label] of WORKFLOWS) {
  console.log(`\n═══ ${label} ═══`);

  const versionId = sql(`select "activeVersionId" from workflow_entity where id='${wf}'`);
  const row = JSON.parse(
    sql(
      `select json_build_object('nodes', nodes, 'conns', connections)::text ` +
        `from workflow_history where "workflowId"='${wf}' and "versionId"='${versionId}'`,
    ),
  );
  const nodes = row.nodes;
  const conns = row.conns;

  if (nodes.some((n) => n.name === 'Telegram BestFilm')) {
    console.log('  ⏭️  аль хэдийн зассан');
    continue;
  }

  const tgIdx = nodes.findIndex((n) => String(n.type).includes('telegram'));
  const hook = nodes.find((n) => String(n.type).includes('webhook'));
  if (tgIdx < 0 || !hook) {
    console.error('  ⛔ Telegram эсвэл Webhook node олдсонгүй');
    process.exitCode = 1;
    continue;
  }
  const tg = nodes[tgIdx];

  /* ── Telegram node руу ЮУ холбогддог, тэр нь ХААШАА явдаг ── */
  const upstream = Object.entries(conns).find(([, c]) =>
    (c.main ?? []).some((arr) => (arr ?? []).some((x) => x.node === tg.name)),
  );
  if (!upstream) {
    console.error('  ⛔ Telegram-ын өмнөх node олдсонгүй');
    process.exitCode = 1;
    continue;
  }
  const [upName] = upstream;
  const downstream = conns[tg.name]?.main?.[0] ?? [];

  console.log(`  ${upName} → Telegram → ${downstream.map((d) => d.node).join(', ') || '(төгсгөл)'}`);

  /* ── 1. IF node ── */
  const ifNode = {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          {
            id: 'site-check',
            leftValue: `={{ $('${hook.name}').first().json.body.site }}`,
            rightValue: 'bestfilm',
            operator: { type: 'string', operation: 'equals' },
          },
        ],
        combinator: 'and',
      },
      options: {},
    },
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [(tg.position?.[0] ?? 0) - 180, tg.position?.[1] ?? 0],
    id: `if-site-${wf.slice(0, 8)}`,
    name: 'Аль сайт?',
  };

  /* ── 2. BestFilm-ийн Telegram node (хуулбар + өөр credential) ── */
  const tgBf = {
    ...JSON.parse(JSON.stringify(tg)),
    id: `tg-bf-${wf.slice(0, 8)}`,
    name: 'Telegram BestFilm',
    position: [tg.position?.[0] ?? 0, (tg.position?.[1] ?? 0) - 140],
    credentials: { telegramApi: { id: CRED_ID, name: CRED_NAME } },
  };
  tgBf.parameters = { ...tgBf.parameters, chatId: CHAT };

  nodes.push(ifNode, tgBf);

  /* ── 3. Холболт дахин угсрах ── */
  /* upstream → IF (Telegram-ын оронд) */
  for (const arr of conns[upName].main ?? []) {
    for (const x of arr ?? []) {
      if (x.node === tg.name) x.node = ifNode.name;
    }
  }
  /* IF: [0]=true → BestFilm, [1]=false → BestTV */
  conns[ifNode.name] = {
    main: [
      [{ node: tgBf.name, type: 'main', index: 0 }],
      [{ node: tg.name, type: 'main', index: 0 }],
    ],
  };
  /* BestFilm-ийн Telegram → Telegram-тай ИЖИЛ дараагийн node */
  conns[tgBf.name] = { main: [JSON.parse(JSON.stringify(downstream))] };

  console.log(`  + «${ifNode.name}» (IF)  + «${tgBf.name}» (chat ${CHAT})`);

  if (DRY) {
    console.log('  (--dry — бичсэнгүй)');
    continue;
  }

  /* ── Бичих: nodes БА connections ХОЁУЛАА ── */
  const tmp = path.join(os.tmpdir(), `sb-${Date.now()}`);
  const rn = `/tmp/sbn-${Date.now()}-${wf.slice(0, 6)}.json`;
  const rc = `/tmp/sbc-${Date.now()}-${wf.slice(0, 6)}.json`;

  fs.writeFileSync(tmp, JSON.stringify(nodes), 'utf8');
  execFileSync('scp', ['-o', 'StrictHostKeyChecking=no', tmp, `digitalger-vps:${rn}`], { stdio: 'pipe' });
  fs.writeFileSync(tmp, JSON.stringify(conns), 'utf8');
  execFileSync('scp', ['-o', 'StrictHostKeyChecking=no', tmp, `digitalger-vps:${rc}`], { stdio: 'pipe' });
  fs.unlinkSync(tmp);

  execFileSync('ssh', [...SSH,
    `docker cp ${rn} digitalger-n8n-postgres:${rn} && docker cp ${rc} digitalger-n8n-postgres:${rc}`,
  ], { stdio: 'pipe' });

  const q =
    `BEGIN; ` +
    `UPDATE workflow_history SET nodes = pg_read_file('${rn}')::json, connections = pg_read_file('${rc}')::json ` +
    `WHERE "workflowId"='${wf}' AND "versionId"='${versionId}'; ` +
    `UPDATE workflow_entity SET nodes = pg_read_file('${rn}')::json, connections = pg_read_file('${rc}')::json, "updatedAt"=now() ` +
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
    const n = sql(
      `select count(*) from ${table}, json_array_elements(nodes) n where ${where} and n->>'name' in ('Telegram BestFilm','Аль сайт?')`,
    );
    if (n !== '2') {
      console.error(`  ⛔ ${table}: node ${n}/2`);
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
  console.log(`⚠️ ЗААВАЛ ТЕСТ: хоёр сайтын мэдэгдэл ӨӨР bot-оор ирэхийг батал`);
}
