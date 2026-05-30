# -*- coding: utf-8 -*-
# Шинэ AI Tool keyword-extraction workflow угсарна.
# Урсгал: FB Message -> Parse -> Get User Profile -> Prep Context -> AI Agent
#          -> Extract Keyword -> Search by Keyword -> Build Messages
#          -> Send Text -> Has Cards? -> Send Cards
import json, os

base = os.path.dirname(os.path.abspath(__file__))

def rd(name):
    with open(os.path.join(base, name), 'r', encoding='utf-8') as f:
        return f.read()

code_prep    = rd('code_prep.js')
code_extract = rd('code_extract.js')
code_build   = rd('code_build.js')
code_parse   = rd('code_parse.js')
system_msg   = rd('system_message.txt')

# Хуучин workflow-оос тогтвортой node-уудын параметрийг авна
with open(os.path.join(base, 'current_workflow.json'), 'r', encoding='utf-8') as f:
    old = json.load(f)
old_nodes = {n['name']: n for n in old['nodes']}

FB_TOKEN = "{{ $env['FB_PAGE_ACCESS_TOKEN'] }}"

nodes = []

# 1. FB Verify (GET) — хэвээр
nodes.append(old_nodes['FB Verify (GET)'])
# 2. Respond Challenge — хэвээр
nodes.append(old_nodes['Respond Challenge'])
# 3. FB Message (POST) — хэвээр
nodes.append(old_nodes['FB Message (POST)'])
# 4. Parse — ШИНЭ код (postback + quick_reply/Ice Breaker уншина)
parse_node = old_nodes['Parse']
parse_node['parameters']['jsCode'] = code_parse
nodes.append(parse_node)
# 5. Get User Profile — хэвээр
nodes.append(old_nodes['Get User Profile'])

# 6. Prep Context — ШИНЭ код (pre-search хасагдсан, хялбаршсан)
prep = old_nodes['Prep Context']
prep['parameters']['jsCode'] = code_prep
prep['position'] = [800, 416]
nodes.append(prep)

# 7. AI Agent — ШИНЭ system message (keyword extraction)
agent = old_nodes['AI Agent']
agent['parameters']['options']['systemMessage'] = system_msg
agent['position'] = [1024, 416]
nodes.append(agent)

# OpenAI Chat Model + Postgres Memory — хэвээр
nodes.append(old_nodes['OpenAI Chat Model'])
nodes.append(old_nodes['Postgres Memory'])

# 8. Extract Keyword — ШИНЭ Code node
nodes.append({
    "parameters": {"jsCode": code_extract},
    "id": "node_extract_kw",
    "name": "Extract Keyword",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [1280, 416],
})

# 9. Search by Keyword — ШИНЭ HTTP node (ЦЭВЭР keyword-оор backend дуудна)
nodes.append({
    "parameters": {
        "method": "POST",
        "url": "https://api.digitalger.mn/api/ai/search",
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": "={\n  \"query\": \"{{ ($json.keyword || '').replace(/\"/g, '\\\\\"') }}\"\n}",
        "options": {"response": {"response": {"neverError": True}}, "timeout": 10000},
    },
    "id": "node_search_kw",
    "name": "Search by Keyword",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [1504, 416],
    "onError": "continueRegularOutput",
})

# 10. Build Messages — ШИНЭ код (Extract + Search үр дүнгээс carousel)
build = old_nodes['Build Messages']
build['parameters']['jsCode'] = code_build
build['position'] = [1728, 416]
nodes.append(build)

# 11. Send Text — хэвээр (байрлал шилжүүлнэ)
st = old_nodes['Send Text']; st['position'] = [1952, 416]
nodes.append(st)
# 12. Has Cards? — хэвээр
hc = old_nodes['Has Cards?']; hc['position'] = [2176, 416]
nodes.append(hc)
# 13. Send Cards — хэвээр
sc = old_nodes['Send Cards']; sc['position'] = [2400, 320]
nodes.append(sc)

# Connections — шинэ урсгал
connections = {
    "FB Verify (GET)": {"main": [[{"node": "Respond Challenge", "type": "main", "index": 0}]]},
    "FB Message (POST)": {"main": [[{"node": "Parse", "type": "main", "index": 0}]]},
    "Parse": {"main": [[{"node": "Get User Profile", "type": "main", "index": 0}]]},
    "Get User Profile": {"main": [[{"node": "Prep Context", "type": "main", "index": 0}]]},
    "Prep Context": {"main": [[{"node": "AI Agent", "type": "main", "index": 0}]]},
    "AI Agent": {"main": [[{"node": "Extract Keyword", "type": "main", "index": 0}]]},
    "OpenAI Chat Model": {"ai_languageModel": [[{"node": "AI Agent", "type": "ai_languageModel", "index": 0}]]},
    "Postgres Memory": {"ai_memory": [[{"node": "AI Agent", "type": "ai_memory", "index": 0}]]},
    "Extract Keyword": {"main": [[{"node": "Search by Keyword", "type": "main", "index": 0}]]},
    "Search by Keyword": {"main": [[{"node": "Build Messages", "type": "main", "index": 0}]]},
    "Build Messages": {"main": [[{"node": "Send Text", "type": "main", "index": 0}]]},
    "Send Text": {"main": [[{"node": "Has Cards?", "type": "main", "index": 0}]]},
    "Has Cards?": {"main": [[{"node": "Send Cards", "type": "main", "index": 0}], []]},
}

# n8n import:workflow бүрэн workflow object хүлээдэг
wf = {
    "name": "Facebook Chatbot — DigitalGer AI",
    "nodes": nodes,
    "connections": connections,
    "settings": {"executionOrder": "v1"},
}

out = os.path.join(base, '..', 'digitalger_fb_chatbot_v2.json')
with open(out, 'w', encoding='utf-8') as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)

# Validate
with open(out, 'r', encoding='utf-8') as f:
    chk = json.load(f)
print("OK nodes=%d connections=%d" % (len(chk['nodes']), len(chk['connections'])))
print("node names:", [n['name'] for n in chk['nodes']])
