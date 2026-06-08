const body = $input.item.json.body;

const level = (body.level || 'warning').toLowerCase();
const icon = level === 'critical' ? '\uD83D\uDD34' : '\uD83D\uDFE1';
const title = body.title || 'Системийн анхааруулга';
const message = body.message || '';
const source = body.source ? `\n\u0413\u0430\u0440\u0430\u043b: ${body.source}` : '';
const at = body.emittedAt
  ? new Date(body.emittedAt).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })
  : new Date().toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' });

return [{
  json: {
    message: `${icon} ${title}\n\n${message}${source}\n\u0426\u0430\u0433: ${at}`
  }
}];