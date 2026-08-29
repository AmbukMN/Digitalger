# -*- coding: utf-8 -*-
"""
n8n дахь 3-р page (Шилдэг кино) токеныг ШИНЭ (8 эрхтэй) токеноор солино.

⚠️ Хуучин токен ердөө 3 эрхтэй байсан тул `feed` subscription
   идэвхжүүлэх боломжгүй, коммент webhook ОГТ ирдэггүй байв.

⚠️ Скрипт нь бичсний ДАРАА баталгаажуулна — өмнө JS quote алдагдаж
   чат 2 минут унтарсан.
"""
import json
import re
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")

WF = "BestTVFBChat01"
PG = "digitalger-n8n-postgres"
PAGE3 = "2237164766611647"


def sh(args, **kw):
    return subprocess.run(args, capture_output=True, text=True, **kw)


def run_sql(sql: str) -> str:
    open("/tmp/_q.sql", "w", encoding="utf-8").write(sql)
    r = sh(["docker", "exec", "-i", PG, "psql", "-U", "n8n", "-d", "n8n", "-t", "-A", "-f", "-"],
           stdin=open("/tmp/_q.sql", encoding="utf-8"))
    if r.returncode:
        raise SystemExit(f"SQL алдаа: {r.stderr[:250]}")
    return r.stdout


def main() -> None:
    new = open("/tmp/pt3.txt", encoding="utf-8").read().strip()
    if not new:
        raise SystemExit("шинэ токен уншигдсангүй")

    raw = run_sql(
        f'SELECT nodes::text FROM workflow_history '
        f'WHERE "workflowId" = \'{WF}\' ORDER BY "createdAt" DESC LIMIT 1;'
    ).strip()
    if not raw:
        raise SystemExit("workflow олдсонгүй")

    open("/tmp/nb_p3upd.json", "w", encoding="utf-8").write(raw)

    # ⚠️ Зураглал дахь ХУУЧИН токеныг шинээр солино
    pat = re.compile(rf"'{PAGE3}':'[^']+'")
    hits = len(pat.findall(raw))
    print(f"  зураглал олдсон: {hits}")
    if hits == 0:
        raise SystemExit("⚠️ зураглал олдсонгүй")

    txt = pat.sub(f"'{PAGE3}':'{new}'", raw)
    nodes = json.loads(txt)          # ⚠️ JSON зөв үлдсэн эсэхийг ЭНД барина

    open("/tmp/nn_p3upd.json", "w", encoding="utf-8").write(
        json.dumps(nodes, ensure_ascii=False)
    )
    sh(["docker", "cp", "/tmp/nn_p3upd.json", f"{PG}:/tmp/nu.json"])

    upd = (
        "\\set nodes `cat /tmp/nu.json`\n"
        f"UPDATE workflow_history SET nodes = :'nodes'::json WHERE \"workflowId\" = '{WF}';\n"
        f"UPDATE workflow_entity  SET nodes = :'nodes'::json WHERE id = '{WF}';\n"
    )
    open("/tmp/_u.sql", "w", encoding="utf-8").write(upd)
    sh(["docker", "cp", "/tmp/_u.sql", f"{PG}:/tmp/u.sql"])
    r = sh(["docker", "exec", PG, "psql", "-U", "n8n", "-d", "n8n", "-f", "/tmp/u.sql"])
    print(r.stdout.strip() or r.stderr[:250])

    after = run_sql(
        f'SELECT nodes::text FROM workflow_history WHERE "workflowId" = \'{WF}\';'
    ).strip()
    print(f"  баталгаа: шинэ токен {after.count(new)} газарт")

    # ⚠️ JS quote бүтэн үлдсэн эсэх
    ok = all(
        ("var PAGEID3='" in (n.get("parameters") or {}).get("jsCode", ""))
        or ("PAGEID3" not in (n.get("parameters") or {}).get("jsCode", ""))
        for n in json.loads(after)
    )
    print("  quote бүтэн:", ok)
    if not ok:
        raise SystemExit("⚠️ quote алдагдсан — БУЦААХ шаардлагатай")


if __name__ == "__main__":
    main()
