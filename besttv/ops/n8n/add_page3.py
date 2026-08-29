# -*- coding: utf-8 -*-
"""
n8n чатбот workflow-д ГУРАВ ДАХЬ Facebook page нэмнэ.

⚠️⚠️ Meta нь page тус бүрийн ӨӨРИЙН токеныг шаарддаг. Шинэ page-ийг
   зураглалд нэмэхгүй бол түүний чат ҮНДСЭН токеноор явж,
   `(#100) No matching user found` буцаана — зурвас ОГТ ХҮРЭХГҮЙ,
   админ мэдэхгүй үлдэнэ (чимээгүй эвдрэл).

Гурван зүйл засна:
  1. Токен зураглал (`const T={...}`) — шинэ page нэмнэ
  2. `PAGEID2` хувьсагчийн хажууд `PAGEID3` — өөрийн сэтгэгдэлд
     хариулахаас сэргийлнэ (эс бөгөөс бот өөртэйгөө хязгааргүй ярина)
  3. Fallback (`||PAGEID2`) илэрвэл PAGEID3-ыг ч оруулна

⚠️ Скрипт нь бичсний ДАРАА ЗААВАЛ баталгаажуулна — өмнө JS-ийн quote
   shell-д алдагдаж чат 2 минут унтарсан.
"""
import json
import re
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")

WF = "BestTVFBChat01"
PG = "digitalger-n8n-postgres"
PAGE3 = "2237164766611647"
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
    return sh(["docker", "exec", "besttv-backend", "printenv", var]).stdout.strip()


def main() -> None:
    tok3 = env("FB_PAGE_ACCESS_TOKEN_3")
    if not tok3:
        raise SystemExit("FB_PAGE_ACCESS_TOKEN_3 уншигдсангүй")

    raw = run_sql(
        f'SELECT nodes::text FROM workflow_history '
        f'WHERE "workflowId" = \'{WF}\' ORDER BY "createdAt" DESC LIMIT 1;'
    ).strip()
    if not raw:
        raise SystemExit("workflow олдсонгүй")

    open("/tmp/nodes_backup_p3.json", "w", encoding="utf-8").write(raw)
    nodes = json.loads(raw)

    if PAGE3 in raw:
        raise SystemExit("шинэ page аль хэдийн нэмэгдсэн — алгасав")

    n_map = n_var = n_guard = 0

    for node in nodes:
        s = json.dumps(node, ensure_ascii=False)
        before = s

        # ── 1) Токен зураглал: '<page2>':'<tok2>' -ийн ДАРАА page3 нэмнэ ──
        #    ⚠️ Зураглал бүрийн page2 мөрийг олж, ард нь залгана.
        def add_to_map(m: re.Match) -> str:
            return m.group(0) + f",'{PAGE3}':'{tok3}'"

        s = re.sub(rf"'{PAGE2}':'[^']+'", add_to_map, s)

        # ── 2) `var PAGEID2='...';` -ийн ДАРАА PAGEID3 зарлана ──
        s = s.replace(
            f"var PAGEID2='{PAGE2}';",
            f"var PAGEID2='{PAGE2}';\\nvar PAGEID3='{PAGE3}';",
        )

        # ── 3) Өөрийн сэтгэгдэл/зурвасын хамгаалалт ──
        #    ⚠️ `fbFrom===PAGEID2` бүрд PAGEID3-ыг ч нэмнэ, эс бөгөөс бот
        #       шинэ page-ийн ӨӨРИЙН сэтгэгдэлд хариулж давталтад орно.
        s = s.replace("fbFrom===PAGEID2", "fbFrom===PAGEID2||fbFrom===PAGEID3")

        if s == before:
            continue
        fixed = json.loads(s)
        node.clear()
        node.update(fixed)
        n_map += before.count(f"'{PAGE2}':'")
        if "PAGEID3" in s and "var PAGEID3" in s:
            n_var += 1
        if "fbFrom===PAGEID3" in s:
            n_guard += 1

    print(f"зураглалд нэмсэн: {n_map} | PAGEID3 зарласан: {n_var} | хамгаалалт: {n_guard}")
    if n_map == 0:
        raise SystemExit("⚠️ зураглал олдсонгүй — гараар шалгана")

    out = json.dumps(nodes, ensure_ascii=False)
    open("/tmp/nodes_new_p3.json", "w", encoding="utf-8").write(out)

    sh(["docker", "cp", "/tmp/nodes_new_p3.json", f"{PG}:/tmp/np3.json"])
    upd = (
        "\\set nodes `cat /tmp/np3.json`\n"
        f"UPDATE workflow_history SET nodes = :'nodes'::json WHERE \"workflowId\" = '{WF}';\n"
        f"UPDATE workflow_entity  SET nodes = :'nodes'::json WHERE id = '{WF}';\n"
    )
    open("/tmp/_u_p3.sql", "w", encoding="utf-8").write(upd)
    sh(["docker", "cp", "/tmp/_u_p3.sql", f"{PG}:/tmp/up3.sql"])
    r = sh(["docker", "exec", PG, "psql", "-U", "n8n", "-d", "n8n", "-f", "/tmp/up3.sql"])
    print(r.stdout.strip() or r.stderr[:300])

    # ── БАТАЛГААЖУУЛАЛТ ──
    after = json.loads(run_sql(
        f'SELECT nodes::text FROM workflow_history WHERE "workflowId" = \'{WF}\';'
    ).strip())
    txt = json.dumps(after, ensure_ascii=False)
    print(f"баталгаа: page3={txt.count(PAGE3)} лавлагаа | page2={txt.count(PAGE2)}")

    # ⚠️ JS quote бүтэн үлдсэн эсэх — өмнөх алдааны сургамж
    ok = True
    for n in after:
        js = (n.get("parameters") or {}).get("jsCode") or ""
        if "PAGEID2" in js and "var PAGEID2='" not in js:
            ok = False
    print("quote бүтэн:", ok)
    if not ok:
        raise SystemExit("⚠️ quote алдагдсан — БУЦААХ шаардлагатай")


if __name__ == "__main__":
    main()
