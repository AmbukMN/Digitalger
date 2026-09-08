select n->'parameters'->>'jsCode'
from workflow_history h, json_array_elements(h.nodes) n
where h."workflowId"='BestTVFBChat01'
  and h."versionId"=(select "activeVersionId" from workflow_entity where id='BestTVFBChat01')
  and n->>'name'='Build Reply';
