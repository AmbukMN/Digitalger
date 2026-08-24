#!/usr/bin/env node
/**
 * BestTV bulk episode uploader — bulteek_downloads-ийн БЭЛЭН (лого солисон)
 * видеог backend admin API-аар R2 руу multipart upload хийж, episode-д онооно.
 *
 * ⚠️ Видео нь process-series.sh-ээр АЛЬ ХЭДИЙН BestTV лого солигдсон тул
 *    backend дахин watermark нэмэхгүй (episode.watermark=false).
 *
 * Найдвартай байдал:
 *  - State файл (bulteek-upload-state.json): дууссан episode-ыг тэмдэглэж
 *    ДАХИН upload хийхгүй (cron давтан ажиллаж болно).
 *  - Season/Episode байхгүй бол API-аар үүсгэнэ.
 *  - Multipart тул том файл (1GB+) найдвартай, хэсэг PUT амжилтгүй бол retry.
 *  - streamStatus=READY эсвэл PROCESSING episode-ыг алгасна (давхар хөрвүүлэхгүй).
 *
 * Ажиллуулах:  node bulteek-upload.mjs [--once]
 *   --once  : нэг удаа гүйгээд гарна (cron-д). Үгүй бол цуврал бүрийг дараалан.
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { setTimeout as sleep } from 'node:timers/promises';

const API = process.env.BESTTV_API || 'https://besttv.us/api';
const EMAIL = process.env.BESTTV_ADMIN_EMAIL || 'admin@besttv.mn';
const PASSWORD = process.env.BESTTV_ADMIN_PASSWORD || 'Admin@12345';
const DL_DIR = process.env.BULTEEK_DIR || 'D:/bulteek_downloads';
const STATE_FILE = path.join(DL_DIR, 'bulteek-upload-state.json');
const PART_SIZE = 64 * 1024 * 1024; // 64MB хэсэг
const PART_RETRY = 4;

/**
 * ЦУВРАЛ БҮРИЙН ТОДОРХОЙЛОЛТ.
 *   folder : *_besttv доторх бэлэн видео (prefix-NN.mp4)
 *   prefix : файлын угтвар
 *   count  : нийт анги
 *   titleSlug : BestTV Title.slug (episode энд холбогдоно)
 * Тэнгэрлэг айдол = гол зорилго. Бусад нь дутуу үлдсэн ангийг гүйцээхэд.
 */
const SERIES = [
  { folder: 'aluurchin_besttv',     prefix: 'Aluurchin_busgui_dub_E', count: 12, titleSlug: 'aluurchin-busguy' },
  { folder: 'tengerleg_besttv',     prefix: 'Tengerleg_aidol_dub_E', count: 12, titleSlug: 'tengerleg-aidol' },
  { folder: 'saryn_naiz_besttv',    prefix: 'Saryn_naiz_zaluu_E',    count: 10, titleSlug: 'sar-n-naiz-zaluu' },
  { folder: 'tany_zalgasan_besttv', prefix: 'Tany_zalgasan_dugaar_E', count: 12, titleSlug: 'tany-zalgasan-dugaar' },
  { folder: 'nud_besttv',           prefix: 'Nud_gyalbam_hair_E',    count: 32, titleSlug: 'nud-gyalbam-hair' },
  { folder: 'ene_besttv',           prefix: 'Ene_hairyg_orchuulj_E', count: 12, titleSlug: 'ene-khair-g-orchuulzh-bolokh-uu' },
  { folder: 'amidral_besttv',       prefix: 'Amidral_churj_uguhud_E', count: 16, titleSlug: 'amdral-chamd-zhurzh-ogokhod' },
  { folder: '21r_hanhuu_besttv',    prefix: '21r_zuuni_hanhuu_ehner_E', count: 12, titleSlug: '21-khankhuugiin-ekhner' },
];

let TOKEN = '';
let TOKEN_AT = 0; // сүүлд login хийсэн үе (ms)

function log(...a) { console.log(new Date().toISOString().slice(11, 19), ...a); }

// ── Login (token авах/шинэчлэх) ──────────────────────────────────────────
// ⚠️ JWT нь ~15 минут хүчинтэй. Урт upload (олон GB) үед хугацаа дуусаж 401
//    гардаг тул: (1) 12 мин тутам proactive refresh, (2) 401 дээр re-login+retry.
async function ensureToken(force = false) {
  const ageMs = Date.now() - TOKEN_AT;
  if (!force && TOKEN && ageMs < 12 * 60 * 1000) return;
  const r = await rawJson('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
  TOKEN = r.accessToken;
  TOKEN_AT = Date.now();
  if (!TOKEN) throw new Error('Login амжилтгүй');
}

// ── HTTP helper (JSON, token-гүй raw) ────────────────────────────────────
function rawJson(method, urlPath, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const u = new URL(API + urlPath);
    const req = https.request(u, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...extraHeaders,
      },
    }, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(buf ? JSON.parse(buf) : {}); } catch { resolve(buf); }
        } else {
          const err = new Error(`${method} ${urlPath} → ${res.statusCode}: ${buf.slice(0, 300)}`);
          err.status = res.statusCode;
          reject(err);
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ── HTTP helper (JSON, token+auto-refresh) ───────────────────────────────
// Login-аас бусад бүх дуудлагад token баталгаажуулж, 401 дээр нэг удаа
// re-login хийж дахин оролдоно.
async function apiJson(method, urlPath, body, extraHeaders = {}) {
  await ensureToken();
  try {
    return await rawJson(method, urlPath, body, extraHeaders);
  } catch (e) {
    if (e.status === 401) {
      log('    token 401 → re-login');
      await ensureToken(true);
      return await rawJson(method, urlPath, body, extraHeaders);
    }
    throw e;
  }
}

// ── R2 presigned PUT (нэг хэсэг) → ETag буцаана ─────────────────────────
function putPart(urlStr, chunk) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.request(u, {
      method: 'PUT',
      headers: { 'Content-Length': chunk.length },
    }, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const etag = res.headers.etag || res.headers.ETag;
          if (!etag) return reject(new Error('ETag ирсэнгүй'));
          resolve(etag.replace(/"/g, ''));
        } else {
          reject(new Error(`PUT part → ${res.statusCode}: ${buf.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(chunk);
    req.end();
  });
}

// ── State ───────────────────────────────────────────────────────────────
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}
function saveState(s) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

// ── Нэг файлыг R2 руу multipart upload → rawKey ─────────────────────────
async function uploadFile(filePath) {
  const fileName = path.basename(filePath);
  const size = fs.statSync(filePath).size;
  log(`  upload эхэлж байна: ${fileName} (${(size / 1024 / 1024).toFixed(0)}MB)`);

  const { key, uploadId } = await apiJson('POST', '/admin/uploads/video/multipart/init', { fileName });
  const totalParts = Math.ceil(size / PART_SIZE);
  const parts = [];
  const fd = fs.openSync(filePath, 'r');

  try {
    // Хэсэг бүрд presigned URL-ыг 10-аар багцлан авна
    for (let start = 1; start <= totalParts; start += 10) {
      const nums = [];
      for (let n = start; n < start + 10 && n <= totalParts; n++) nums.push(n);
      const { urls } = await apiJson('POST', '/admin/uploads/video/multipart/urls', {
        key, uploadId, partNumbers: nums,
      });
      for (const { partNumber, url } of urls) {
        const offset = (partNumber - 1) * PART_SIZE;
        const len = Math.min(PART_SIZE, size - offset);
        const chunk = Buffer.alloc(len);
        fs.readSync(fd, chunk, 0, len, offset);
        let etag = null, lastErr = null;
        for (let att = 1; att <= PART_RETRY; att++) {
          try { etag = await putPart(url, chunk); break; }
          catch (e) { lastErr = e; log(`    part ${partNumber} retry ${att}: ${e.message}`); await sleep(3000 * att); }
        }
        if (!etag) throw new Error(`Part ${partNumber} амжилтгүй: ${lastErr?.message}`);
        parts.push({ ETag: etag, PartNumber: partNumber });
        if (partNumber % 5 === 0 || partNumber === totalParts) {
          log(`    ${partNumber}/${totalParts} хэсэг`);
        }
      }
    }
  } finally {
    fs.closeSync(fd);
  }

  parts.sort((a, b) => a.PartNumber - b.PartNumber);
  await apiJson('POST', '/admin/uploads/video/multipart/complete', { key, uploadId, parts });
  log(`  ✅ R2 upload дууслаа: ${key}`);
  return key;
}

// ── Гол урсгал ──────────────────────────────────────────────────────────
async function main() {
  log('=== BestTV bulteek uploader START ===');
  await ensureToken(true);
  log('admin нэвтэрлээ');

  const state = loadState();

  for (const S of SERIES) {
    const dir = path.join(DL_DIR, S.folder);
    if (!fs.existsSync(dir)) { log(`${S.folder}: folder алга, алгаслаа`); continue; }

    // Title + Season олох/үүсгэх
    const admin = await apiJson('GET', `/admin/titles?search=${encodeURIComponent(S.titleSlug)}&take=50`).catch(() => null);
    let title = null;
    // API хэлбэр өөр байж болзошгүй тул хэд хэдэн талбар шалгана
    const list = admin?.items || admin?.data || admin || [];
    if (Array.isArray(list)) title = list.find((t) => t.slug === S.titleSlug);
    if (!title) {
      log(`${S.folder}: Title '${S.titleSlug}' олдсонгүй (admin хайлт), алгаслаа`);
      continue;
    }
    log(`\n### ${title.title} (${S.titleSlug}) — ${S.count} анги`);

    // Season авах (эхнийх) эсвэл үүсгэх
    const detail = await apiJson('GET', `/admin/titles/${title.id}`).catch(() => null);
    let seasons = detail?.seasons || [];
    let season = seasons[0];
    if (!season) {
      log('  Season байхгүй → үүсгэж байна (Season 1)');
      season = await apiJson('POST', `/admin/titles/${title.id}/seasons`, { number: 1, name: '' });
    }
    const seasonId = season.id;

    // Season доторх episode-ууд
    let episodes = season.episodes || (await apiJson('GET', `/admin/titles/${title.id}`)).seasons?.find((s) => s.id === seasonId)?.episodes || [];
    const byNum = new Map(episodes.map((e) => [e.number, e]));

    for (let n = 1; n <= S.count; n++) {
      const nn = String(n).padStart(2, '0');
      const src = path.join(dir, `${S.prefix}${nn}.mp4`);
      const stKey = `${S.titleSlug}#${n}`;

      if (!fs.existsSync(src)) { log(`  E${nn}: бэлэн видео алга, алгаслаа`); continue; }
      if (state[stKey]?.done) { continue; } // аль хэдийн upload хийсэн

      // Episode байгаа эсэх → үүсгэх
      let ep = byNum.get(n);
      if (!ep) {
        log(`  E${nn}: episode байхгүй → үүсгэж байна`);
        ep = await apiJson('POST', `/admin/titles/seasons/${seasonId}/episodes`, {
          number: n, watermark: false, // лого АЛЬ ХЭДИЙН солисон
        });
        byNum.set(n, ep);
      }

      // Аль хэдийн READY/PROCESSING бол алгасна (давхар хөрвүүлэхгүй)
      const status = ep.streamStatus;
      if (status === 'READY' || status === 'PROCESSING') {
        log(`  E${nn}: streamStatus=${status} — алгаслаа (тэмдэглэв)`);
        state[stKey] = { done: true, episodeId: ep.id, skipped: status };
        saveState(state);
        continue;
      }

      try {
        // watermark=false баталгаажуулна (лого давхар нэмэхгүй)
        await apiJson('PATCH', `/admin/titles/episodes/${ep.id}`, { watermark: false }).catch(() => {});
        const rawKey = await uploadFile(src);
        await apiJson('POST', '/admin/uploads/video/complete', {
          target: 'episode', targetId: ep.id, rawKey,
        });
        state[stKey] = { done: true, episodeId: ep.id, rawKey, at: new Date().toISOString() };
        saveState(state);
        log(`  ✅ E${nn} DONE → episode ${ep.id} PROCESSING (HLS queue)`);
      } catch (e) {
        log(`  ❌ E${nn} FAIL: ${e.message}`);
      }
    }
  }
  log('=== uploader DONE ===');
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
