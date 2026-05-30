// Extract Keyword — AI Agent-ийн хариунаас [SEARCH:keyword] салгана.
// keyword байвал → дараагийн HTTP node backend-ийг ЦЭВЭР keyword-оор дуудна.
// [SEARCH:...] тэмдгийг хэрэглэгчид харагдах текстээс арилгана.
const prep = $('Prep Context').first().json;
const psid = prep.psid;
let raw = ($input.first().json.output || '').trim();
// [SEARCH:xxx] эсвэл [SEARCH: xxx] хайх (кирилл/латин/зай хүлээнэ)
let keyword = '';
const m = raw.match(/\[SEARCH:\s*([^\]]*)\]/i);
if (m) {
  keyword = (m[1] || '').trim();
}
// Тэмдгийг текстээс бүрэн арилгана (хэд ч байж болно)
let replyText = raw.replace(/\[SEARCH:[^\]]*\]/ig, '').trim();
// Markdown цэвэрлэх: [текст](url) → "текст url", ** __ устгах
function stripMd(s){ s=String(s||''); var r='',i=0; while(i<s.length){ if(s[i]==='['){ var c=s.indexOf('](',i); if(c!==-1){ var e=s.indexOf(')',c+2); if(e!==-1){ r+=s.slice(i+1,c)+' '+s.slice(c+2,e); i=e+1; continue; } } } r+=s[i]; i++; } return r.split('**').join('').split('__').join('').trim(); }
replyText = stripMd(replyText);
const doSearch = keyword.length >= 2;
if (!replyText) replyText = doSearch ? 'Танд тохирох бүтээгдэхүүн хайж байна...' : 'Уучлаарай, дахин бичнэ үү.';
return [{ json: { psid, keyword, doSearch, replyText } }];
