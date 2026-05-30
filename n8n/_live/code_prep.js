// Prep Context — AI Agent-аас ӨМНӨ ажиллана. Pre-search БАЙХГҮЙ.
// Зөвхөн psid, userText, firstName бэлдэж AI-д өгөх agentInput угсарна.
// AI өөрөө өгүүлбэрийг ойлгож [SEARCH:keyword] гаргана (хайлтыг дараа нь хийнэ).
const NL = String.fromCharCode(10);
const psid = $('Parse').first().json.psid;
const userText = $('Parse').first().json.text;
const profile = $('Get User Profile').first().json || {};
const firstName = (profile.first_name || '').trim();
const isGetStarted = (userText === '__GET_STARTED__');
const nameLine = firstName ? ('Хэрэглэгчийн нэр: ' + firstName) : '';
let agentInput;
if (isGetStarted) {
  agentInput = [nameLine, '=== ОНЦГОЙ: хэрэглэгч анх удаа орж ирлээ. Дулаан угтах мэндчилгээ бич, DigitalGer-ийг товч танилцуул. Бүтээгдэхүүн хайхгүй. ==='].filter(Boolean).join(NL);
} else {
  agentInput = [nameLine, '=== ХЭРЭГЛЭГЧИЙН МЕССЕЖ ===', userText].filter(Boolean).join(NL);
}
return [{ json: { psid, userText, firstName, agentInput, isGetStarted } }];
