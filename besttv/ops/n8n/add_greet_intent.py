# -*- coding: utf-8 -*-
"""
BestTV чатбот — МЭНДЧИЛГЭЭ таних логик нэмнэ.

⚠️⚠️ ЭНЭ СКРИПТИЙГ VPS ДЭЭР АЖИЛЛУУЛНА (n8n DB-д хандана).

БОДИТ ГОМДОЛ: «Sainuu» гэж бичихэд бот «"sainuu"-тэй холбоотой кино
олдсонгүй 🙁» гэж хариулдаг байв — мэндчилгээ гэсэн ойлголт ОГТ
байгаагүй тул БҮХ текст кино хайлт руу унадаг.

⚠️ Өмнөх оролдлого JS-ийн `'` тэмдэгт shell escape-д АЛДАГДАЖ
   SyntaxError өгсөн. Тиймээс кодыг Python файл дотор БҮТНЭЭР бичиж,
   JSON-оор дамжуулна (shell-д огт хүрэхгүй).
"""
import json
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")

WF = "BestTVFBChat01"
PG = "digitalger-n8n-postgres"

# ── JS блок — энд `'` чөлөөтэй бичигдэнэ (shell хүрэхгүй) ─────────────
GREET_BLOCK = r"""/**
 * ⚠️⚠️ МЭНДЧИЛГЭЭ — «сайн уу», «hello», «sainuu» г.м.
 *
 * БОДИТ ГОМДОЛ: «Sainuu» гэж бичихэд бот «кино олдсонгүй 🙁» гэж
 * хариулдаг байв. Мэндчилгээ гэсэн ойлголт ОГТ БАЙГААГҮЙ тул БҮХ
 * текст кино хайлт руу унадаг.
 *
 * ⚠️ БҮТЭН ҮГ тулгана (`_hits` шиг substring БИШ) — «hi» нь
 *    «hishig» дотор, «сайн» нь «сайн байна уу энэ кино байна уу»
 *    дотор таарч, жинхэнэ асуултыг мэндчилгээ гэж андуурна.
 *
 * ⚠️ Дараалал: заавар/үнэ/данс шалгалтын ДАРАА — «сайн уу, багц яаж
 *    авах вэ» гэвэл багцын хариу нь илүү хэрэгтэй.
 *
 * ⚠️ ЗӨВХӨН мэндчилгээ ГАНЦААРАА (2 үгээс бага) байвал — «сайн уу,
 *    Хойд аав байна уу» гэвэл кино хайлт руу явна.
 */
if (!directReply) {
  var GREET = ['сайн уу', 'сайнуу', 'сайн байна уу', 'сайн', 'байна уу',
    'sainuu', 'sain uu', 'sain baina uu', 'sain bn uu', 'sainbainauu',
    'hello', 'hi', 'hey', 'helo', 'halo', 'snu', 'snuu', 'сайнбайнауу'];
  var _g = (userText || '').toLowerCase()
    .replace(/[.,!?;:()\[\]«»"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  var _w = _g ? _g.split(' ') : [];
  var _isGreet = false;
  if (_w.length > 0 && _w.length <= 3) {
    for (var _i = 0; _i < GREET.length; _i++) {
      if (_g === GREET[_i]) { _isGreet = true; break; }
    }
    /* ⚠️ Нэг үгтэй мэндчилгээ («hi», «сайнуу») — 1 үг л байхад тооцно.
       2+ үгтэй бол ЯГ таарсан үед л (дээрх шалгалт) — эс бөгөөс
       «hi Хойд аав» гэсэн киноны хайлт мэндчилгээ болно. */
    if (!_isGreet && _w.length === 1) {
      for (var _j = 0; _j < GREET.length; _j++) {
        if (_w[0] === GREET[_j]) { _isGreet = true; break; }
      }
    }
  }
  if (_isGreet) {
    directReply = ['Сайн байна уу! 👋 BestTV-д тавтай морил.', '',
      'Танд юугаар туслах вэ?', '',
      '🎬 Кино хайх — киноны нэрээ бичээрэй',
      '💳 Багц авах — «багц» гэж бичнэ үү',
      '📝 Бүртгүүлэх — «бүртгүүлэх» гэж бичнэ үү',
      '', '👉 https://besttv.us'].join(NL);
  }
}

"""

ANCHOR = "const agentInput = (nameLine ? (nameLine + NL) : '') + (isGetStarted"


def run_sql(sql: str) -> str:
    """⚠️ SQL-ийг ФАЙЛААР дамжуулна — shell quote асуудал гарахгүй."""
    open("/tmp/_q.sql", "w", encoding="utf-8").write(sql)
    r = subprocess.run(
        ["docker", "exec", "-i", PG, "psql", "-U", "n8n", "-d", "n8n", "-t", "-A", "-f", "-"],
        stdin=open("/tmp/_q.sql", encoding="utf-8"),
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        raise SystemExit(f"SQL алдаа: {r.stderr[:300]}")
    return r.stdout


def main() -> None:
    raw = run_sql(
        f'SELECT nodes::text FROM workflow_history '
        f'WHERE "workflowId" = \'{WF}\' ORDER BY "createdAt" DESC LIMIT 1;'
    ).strip()
    if not raw:
        raise SystemExit("workflow олдсонгүй")

    # ⚠️ Нөөц — буцаах шаардлага гарвал
    open("/tmp/nodes_backup2.json", "w", encoding="utf-8").write(raw)
    nodes = json.loads(raw)

    hit = 0
    for n in nodes:
        if n.get("name") != "Prep Context":
            continue
        code = n["parameters"]["jsCode"]
        if "МЭНДЧИЛГЭЭ" in code:
            raise SystemExit("аль хэдийн нэмэгдсэн — алгасав")
        if code.count(ANCHOR) != 1:
            raise SystemExit(f"anchor олдсонгүй: {code.count(ANCHOR)}")
        n["parameters"]["jsCode"] = code.replace(ANCHOR, GREET_BLOCK + ANCHOR, 1)
        hit += 1
    if hit != 1:
        raise SystemExit(f"Prep Context: {hit}")

    out = json.dumps(nodes, ensure_ascii=False)
    open("/tmp/nodes_new2.json", "w", encoding="utf-8").write(out)

    # ⚠️ Контейнер руу хуулж, `\set` -ээр уншуулна — параметр shell-д хүрэхгүй
    subprocess.run(["docker", "cp", "/tmp/nodes_new2.json", f"{PG}:/tmp/nn.json"], check=True)
    upd = (
        "\\set nodes `cat /tmp/nn.json`\n"
        f"UPDATE workflow_history SET nodes = :'nodes'::json WHERE \"workflowId\" = '{WF}';\n"
        f"UPDATE workflow_entity  SET nodes = :'nodes'::json WHERE id = '{WF}';\n"
    )
    open("/tmp/_u.sql", "w", encoding="utf-8").write(upd)
    subprocess.run(["docker", "cp", "/tmp/_u.sql", f"{PG}:/tmp/u.sql"], check=True)
    r = subprocess.run(
        ["docker", "exec", PG, "psql", "-U", "n8n", "-d", "n8n", "-f", "/tmp/u.sql"],
        capture_output=True, text=True,
    )
    print(r.stdout.strip() or r.stderr[:300])

    # ── Баталгаажуулалт ──
    chk = run_sql(
        f"SELECT (nodes::text LIKE '%МЭНДЧИЛГЭЭ%'), "
        f"(nodes::text LIKE '%EAGMrcA8nyrk%') "
        f"FROM workflow_history WHERE \"workflowId\" = '{WF}';"
    ).strip()
    print("greet|token →", chk)

    # ⚠️ JS-ийн quote бүтэн үлдсэн эсэхийг ЗААВАЛ шалгана (өмнөх алдаа)
    code = json.loads(run_sql(
        f'SELECT nodes::text FROM workflow_history WHERE "workflowId" = \'{WF}\';'
    ).strip())
    for n in code:
        if n.get("name") == "Prep Context":
            js = n["parameters"]["jsCode"]
            ok = "'сайн уу'" in js and "'hello'" in js
            print("quote бүтэн эсэх:", ok)
            if not ok:
                raise SystemExit("⚠️ quote алдагдсан — БУЦААХ шаардлагатай")


if __name__ == "__main__":
    main()
