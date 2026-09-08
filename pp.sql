select n->>'name', n->'parameters'->>'jsCode'
from workflow_history h, json_array_elements(h.nodes) n
where h."workflowId"='BestTVFBChat01' and h."versionId"='761dd103-a712-4a38-94a0-972e938cccfa'
  and n->>'name' in ('Parse','Prep Context');
