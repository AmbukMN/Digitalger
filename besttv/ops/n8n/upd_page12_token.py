# -*- coding: utf-8 -*-
"""
n8n дахь Best TV (1) ба Best Tv 2-ын токеныг ШИНЭ (13 эрхтэй) болгоно.

⚠️ Хуучин токенд `pages_read_user_content` БАЙХГҮЙ байсан тул коммент
   уншиж чадахгүй, auto reply ажиллахгүй байв.

⚠️ IG (`17841442595556819`) нь ЭЦЭГ page (Best TV)-ийн токеноор
   ажилладаг тул түүнийг ч ҮНДСЭН токеноор солино.

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
PAGE1 = "108103720808038"
PAGE2 = "1709865179261697"
IGID = "17841442595556819"


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
    t1 = open(f"/tmp/pt_{PAGE1}.txt", encoding="utf-8").read().strip()
    t2 = open(f"/tmp/pt_{PAGE2}.txt", encoding="utf-8").read().strip()
    if not t1 or not t2:
        raise SystemExit("токен уншигдсангүй")

    raw = run_sql(
        f'SELECT nodes::text FROM workflow_history '
        f'WHERE "workflowId" = \'{WF}\' ORDER BY "createdAt" DESC LIMIT 1;'
    ).strip()
    if not raw:
        raise SystemExit("workflow олдсонгүй")
    open("/tmp/nb_p12.json", "w", encoding="utf-8").write(raw)

    txt = raw
    counts = {}
    #  ⚠️ IG нь ЭЦЭГ page-ийн токеноор — үндсэн (t1)-ээр солино
    for page, tok in ((PAGE1, t1), (PAGE2, t2), (IGID, t1)):
        pat = re.compile(rf"'{page}':'[^']+'")
        counts[page] = len(pat.findall(txt))
        txt = pat.sub(f"'{page}':'{tok}'", txt)

    print("  зураглал:", ", ".join(f"{k[-6:]}={v}" for k, v in counts.items()))
    if sum(counts.values()) == 0:
        raise SystemExit("⚠️ зураглал олдсонгүй")

    nodes = json.loads(txt)          # ⚠️ JSON бүтэн үлдсэн эсэхийг ЭНД барина
    open("/tmp/nn_p12.json", "w", encoding="utf-8").write(
        json.dumps(nodes, ensure_ascii=False)
    )
    sh(["docker", "cp", "/tmp/nn_p12.json", f"{PG}:/tmp/nu12.json"])

    upd = (
        "\\set nodes `cat /tmp/nu12.json`\n"
        f"UPDATE workflow_history SET nodes = :'nodes'::json WHERE \"workflowId\" = '{WF}';\n"
        f"UPDATE workflow_entity  SET nodes = :'nodes'::json WHERE id = '{WF}';\n"
    )
    open("/tmp/_u12.sql", "w", encoding="utf-8").write(upd)
    sh(["docker", "cp", "/tmp/_u12.sql", f"{PG}:/tmp/u12.sql"])
    r = sh(["docker", "exec", PG, "psql", "-U", "n8n", "-d", "n8n", "-f", "/tmp/u12.sql"])
    print(r.stdout.strip() or r.stderr[:250])

    after = run_sql(
        f'SELECT nodes::text FROM workflow_history WHERE "workflowId" = \'{WF}\';'
    ).strip()
    print(f"  баталгаа: t1={after.count(t1)} t2={after.count(t2)} газарт")

    # ⚠️ JS quote бүтэн үлдсэн эсэх
    ok = all(
        ("var PAGEID2='" in js) or ("PAGEID2" not in js)
        for js in (
            (n.get("parameters") or {}).get("jsCode", "") for n in json.loads(after)
        )
    )
    print("  quote бүтэн:", ok)
    if not ok:
        raise SystemExit("⚠️ quote алдагдсан — БУЦААХ шаардлагатай")


if __name__ == "__main__":
    main()
