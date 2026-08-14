#!/usr/bin/env node
/**
 * build.js доторх n8n Code node-ийн КОММЕНТОД backtick байгаа эсэхийг шалгана.
 *
 * ⚠️⚠️ ЯАГААД ХЭРЭГТЭЙ ВЭ — энэ алдаа 5 УДАА давтагдсан:
 *
 * n8n Code node-ийн JS-ийг build.js дотор template literal (backtick)
 * дотор бичдэг. Тэр литералын ДОТОРХ комментод backtick тавихад
 * литерал ДУНДУУР нь ТАСАРЧ, Node нь жинхэнэ шалтгаанаас хол мөр
 * заасан ойлгомжгүй алдаа шидэнэ:
 *
 *     SyntaxError: Unexpected identifier 'indexOf'
 *     SyntaxError: Unexpected identifier 'Settings'
 *
 * Энэ шалгуурыг build.js ДОТОР тавьж болохгүй — Node нь файлыг
 * ПАРСЕ хийх үедээ л унадаг тул код ажиллах хүртэл хүрэхгүй.
 * Тиймээс ТУСДАА файл болгож, build-ээс ӨМНӨ ажиллуулна:
 *
 *     node check-backticks.js && BESTTV_FB_TOKEN=... node build.js
 *
 * ⚠️ Template literal-ын ГАДНАХ (ердийн JSDoc) backtick асуудалгүй —
 *    зөвхөн ДОТОРХИЙГ л барина.
 */
const fs = require('fs');
const path = require('path');

const BT = String.fromCharCode(96);
const file = process.argv[2] || path.join(__dirname, 'build.js');
const src = fs.readFileSync(file, 'utf8').split('\n');

let inLiteral = false;
let inBlockComment = false;
const bad = [];

src.forEach((line, i) => {
  const t = line.trim();

  /**
   * ⚠️ JSDoc / блок коммент нь ЛИТЕРАЛААС ГАДНА байвал асуудалгүй —
   *    тэднийг мөрөөр нь мөшгиж алгасана. Эс бөгөөс файл дүүрэн
   *    худал эерэг гарч, жинхэнэ алдаа нүдэнд өртөхгүй.
   */
  const opensBlock = t.startsWith('/*');
  const closesBlock = t.indexOf('*/') !== -1;
  const wasInBlock = inBlockComment;
  if (opensBlock && !closesBlock) inBlockComment = true;
  else if (closesBlock) inBlockComment = false;

  const isPlainComment = wasInBlock || opensBlock || t.startsWith('*') || t.startsWith('//');

  const cnt = (line.match(new RegExp(BT, 'g')) || []).length;

  if (inLiteral) {
    /* Литерал ДОТОРХ коммент — энэ л жинхэнэ аюул */
    if (isPlainComment && cnt > 0) bad.push({ line: i + 1, text: t.slice(0, 72) });
  } else if (!isPlainComment && cnt >= 3) {
    /**
     * Литерал НЭЭГДЭХ мөрөнд 3+ backtick = дунд нь нэг нь литералыг
     * дуусгачихсан. Жишээ: jsCode: `// коммент `x` ...
     */
    bad.push({ line: i + 1, text: t.slice(0, 72) });
  }

  /* Комментын гадна л литералын төлөв өөрчлөгдөнө */
  if (!isPlainComment && cnt % 2 === 1) inLiteral = !inLiteral;
});

if (!bad.length) {
  console.log('✅ n8n кодын комментод backtick алга');
  process.exit(0);
}

console.error('\n⛔ n8n КОДЫН КОММЕНТОД BACKTICK — template literal тасарна!\n');
bad.forEach((b) => console.error('   мөр ' + b.line + ': ' + b.text));
console.error('\n   Засвар: комментод код нэрийг backtick-гүй бич.');
console.error('   Жишээ:  /bank/accounts  (БИШ: `/bank/accounts`)\n');
process.exit(1);
