/**
 * ⚠️⚠️ СЕРВЕР ТАЛЫН FETCH-Д `X-Site` ТОЛГОЙ НЭМЭХ.
 *
 * АСУУДАЛ: сервер талын хүсэлт нь container-хоорондын
 * (`http://backend:4100`) — `Origin` БАЙХГҮЙ, `Host` нь `backend`.
 * Backend түүнийг `besttv` гэж таамаглана.
 *
 * ҮР ДАГАВАР: bestfilm.net-ийн нүүр хуудас BestTV-ийн кино, баннер,
 * SEO харуулна. Хэрэглэгч буруу брэнд харна.
 *
 * ЗАСВАР: `fetch(\`${SERVER_API_URL}/api/x\`, opts)`
 *      →  `serverFetch(\`/api/x\`, opts)`
 *
 * ⚠️ `serverFetch` нь `X-Site` толгойг автоматаар нэмнэ.
 */
import fs from 'node:fs';
import path from 'node:path';

const DRY = process.argv.includes('--dry');
const ROOT = path.join(import.meta.dirname, '..', 'src');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !p.endsWith('server-api.ts')) out.push(p);
  }
  return out;
}

let touched = 0, total = 0;
const manual = [];

for (const file of walk(ROOT)) {
  let s = fs.readFileSync(file, 'utf8');
  if (!s.includes('SERVER_API_URL')) continue;
  const before = s;

  /* fetch(`${SERVER_API_URL}/api/…`  →  serverFetch(`/api/…` */
  s = s.replace(/fetch\(`\$\{SERVER_API_URL\}(\/[^`]*)`/g, 'serverFetch(`$1`');

  const n = (before.match(/fetch\(`\$\{SERVER_API_URL\}/g) ?? []).length;

  if (s !== before) {
    /* import-д serverFetch нэмнэ */
    s = s.replace(
      /import \{([^}]*)\bSERVER_API_URL\b([^}]*)\} from ('@\/lib\/server-api'|'\.\/server-api')/,
      (m, a, b, q) =>
        m.includes('serverFetch')
          ? m
          : `import {${a}SERVER_API_URL, serverFetch${b}} from ${q}`,
    );
    /* SERVER_API_URL хэрэглэгдэхээ больсон бол импортоос хасна */
    const stillUsed = (s.match(/SERVER_API_URL/g) ?? []).length;
    if (stillUsed === 1) {
      s = s.replace(
        /import \{\s*SERVER_API_URL,\s*serverFetch\s*\} from ('@\/lib\/server-api'|'\.\/server-api')/,
        'import { serverFetch } from $1',
      );
    }
    if (!DRY) fs.writeFileSync(file, s, 'utf8');
    console.log(`  ✅ ${path.relative(path.join(ROOT, '..'), file).split('\\').join('/')} — ${n}`);
    touched++; total += n;
  } else {
    /* ⚠️ Хэв маягт таараагүй — ГАРААР шалгах ёстой */
    manual.push(path.relative(path.join(ROOT, '..'), file).split('\\').join('/'));
  }
}

console.log(`\n${touched} файл · ${total} дуудлага${DRY ? '  (--dry)' : ''}`);
if (manual.length) {
  console.log('\n⚠️ ГАРААР шалгах (хэв маягт таараагүй):');
  manual.forEach((m) => console.log(`   · ${m}`));
}
