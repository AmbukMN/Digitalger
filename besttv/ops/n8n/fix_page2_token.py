# -*- coding: utf-8 -*-
"""
n8n workflow дахь PAGE→ТОКЕН зураглалыг ЗАСНА.

⚠️⚠️ БОДИТ АЛДАА: гурван page-д (Best TV, Best Tv 2, IG) БҮГД ижил
   токен бичигдсэн байв — миний өмнөх бөөнөөр солих үйлдэл бүх утгыг
   ижилээр дарж бичсэн.

   Best Tv 2 нь ӨӨРИЙН токентой байх ЁСТОЙ: Meta нь page тус бүрийн
   токеныг шаарддаг тул өөр page-ийн токеноор коммент/DM илгээвэл
   `(#100) No matching user found` буцаана.

⚠️ IG нь ЭЦЭГ page (Best TV)-ийн токеноор ажилладаг тул түүнийг
   солихгүй — үндсэн токен зөв.

⚠️ Скрипт нь бичсний ДАРАА ЗААВАЛ баталгаажуулна (өмнө нь JS-ийн
   quote алдагдаж чат 2 минут унтарсан).
"""
import json
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")

WF = "BestTVFBChat01"
PG = "digitalger-n8n-postgres"
PAGE2 = "1709865179261697"


def sh(args, **kw):
    return subprocess.run(args, capture_output=True, text=True, **kw)


def run_sql(sql: str) -> str:
    open("/tmp/_q.sql", "w", encoding="utf-8").write(sql)
    r = sh(["docker", "exec", "-i", PG, "psql", "-U", "n8n", "-d", "n8n", "-t", "-A", "-f", "-"],
           stdin=open("/tmp/_q.sql", encoding="utf-8"))
    if r.returncode != 0:
        raise SystemExit(f"SQL алдаа: {r.stderr[:300]}")
    return r.stdout


def env(var: str) -> str:
    r = sh(["docker", "exec", "besttv-backend", "printenv", var])
    return r.stdout.strip()


def main() -> None:
    tok1, tok2 = env("FB_PAGE_ACCESS_TOKEN"), env("FB_PAGE_ACCESS_TOKEN_2")
    if not tok1 or not tok2:
        raise SystemExit("токен уншигдсангүй")
    if tok1 == tok2:
        raise SystemExit("⚠️ .env дэх хоёр токен ИЖИЛ — эхлээд .env-ээ зас")

    raw = run_sql(
        f'SELECT nodes::text FROM workflow_history '
        f'WHERE "workflowId" = \'{WF}\' ORDER BY "createdAt" DESC LIMIT 1;'
    ).strip()
    if not raw:
        raise SystemExit("workflow олдсонгүй")

    open("/tmp/nodes_backup3.json", "w", encoding="utf-8").write(raw)
    nodes = json.loads(raw)

    # ⚠️ Зураглал дотор Best Tv 2-ын мөр: '1709865179261697':'<токен>'
    #    Одоо тэнд tok1 бичигдсэн — tok2 болгоно.
    wrong = f"'{PAGE2}':'{tok1}'"
    right = f"'{PAGE2}':'{tok2}'"

    hits = 0
    for n in nodes:
        s = json.dumps(n, ensure_ascii=False)
        if wrong not in s:
            continue
        fixed = json.loads(s.replace(wrong, right))
        n.clear()
        n.update(fixed)
        hits += 1

    if hits == 0:
        print("⚠️ Засах зүйл олдсонгүй — аль хэдийн зөв байж болно")
        # Одоогийн байдлыг харуулна
        for n in nodes:
            s = json.dumps(n, ensure_ascii=False)
            if PAGE2 in s and "EAG" in s:
                i = s.find(f"'{PAGE2}':'")
                print(f"   {n.get('name')}: …{s[i:i+40]}…")
        return

    print(f"засах node: {hits}")
    out = json.dumps(nodes, ensure_ascii=False)
    open("/tmp/nodes_new3.json", "w", encoding="utf-8").write(out)

    sh(["docker", "cp", "/tmp/nodes_new3.json", f"{PG}:/tmp/nn3.json"])
    upd = (
        "\\set nodes `cat /tmp/nn3.json`\n"
        f"UPDATE workflow_history SET nodes = :'nodes'::json WHERE \"workflowId\" = '{WF}';\n"
        f"UPDATE workflow_entity  SET nodes = :'nodes'::json WHERE id = '{WF}';\n"
    )
    open("/tmp/_u3.sql", "w", encoding="utf-8").write(upd)
    sh(["docker", "cp", "/tmp/_u3.sql", f"{PG}:/tmp/u3.sql"])
    r = sh(["docker", "exec", PG, "psql", "-U", "n8n", "-d", "n8n", "-f", "/tmp/u3.sql"])
    print(r.stdout.strip() or r.stderr[:300])

    # ── БАТАЛГААЖУУЛАЛТ ──
    after = json.loads(run_sql(
        f'SELECT nodes::text FROM workflow_history WHERE "workflowId" = \'{WF}\';'
    ).strip())
    ok_wrong = ok_right = 0
    for n in after:
        s = json.dumps(n, ensure_ascii=False)
        ok_wrong += s.count(wrong)
        ok_right += s.count(right)
    print(f"баталгаа: буруу={ok_wrong} (0 байх ёстой)  зөв={ok_right}")
    if ok_wrong:
        raise SystemExit("⚠️ засвар бүрэн ороогүй")


if __name__ == "__main__":
    main()
