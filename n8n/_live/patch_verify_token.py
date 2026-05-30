# -*- coding: utf-8 -*-
# FB Verify token шалгах логик нэмнэ.
# Respond Challenge node: token зөв (FB_VERIFY_TOKEN env) бол challenge буцаана,
# буруу бол хоосон. Ингэснээр гадны хүн challenge endpoint ашиглаж чадахгүй.
import json, os

base = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(base, '..', 'digitalger_fb_chatbot_v2.json')

with open(src, 'r', encoding='utf-8') as f:
    wf = json.load(f)

# n8n expression: hub.verify_token === env FB_VERIFY_TOKEN бол challenge, эс бол хоосон
# responseBody нь n8n expression ({{ }}). $env-ээс verify token уншина.
VERIFY_EXPR = (
    "={{ $json.query['hub.verify_token'] === $env['FB_VERIFY_TOKEN'] "
    "? $json.query['hub.challenge'] : '' }}"
)

patched = False
for n in wf['nodes']:
    if n['name'] == 'Respond Challenge':
        n['parameters']['responseBody'] = VERIFY_EXPR
        patched = True

if not patched:
    raise SystemExit('Respond Challenge node олдсонгүй')

# id + active нэмж import-д бэлдэнэ
wf['id'] = 'CNamkzJ1xMqWKWOr'
wf['active'] = True

# Эх файлыг шинэчилнэ (responseBody засвартай)
with open(src, 'w', encoding='utf-8') as f:
    # id/active-г эх файлд хадгалахгүй (import-д л хэрэгтэй) — салгана
    clean = {k: v for k, v in wf.items() if k not in ('id', 'active')}
    json.dump(clean, f, ensure_ascii=False, indent=2)

# import хувилбар (id+active-тай)
imp = os.path.join(base, 'wf_import.json')
with open(imp, 'w', encoding='utf-8') as f:
    json.dump(wf, f, ensure_ascii=False)

print('patched responseBody =', VERIFY_EXPR)
print('nodes =', len(wf['nodes']))
