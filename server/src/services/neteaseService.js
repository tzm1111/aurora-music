import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let embeddedApi;
// 网易云音乐 provider
// 依赖本地运行的 NeteaseCloudMusicApi（见 aurora-music/music-api）
// 只暴露：搜索、播放地址解析、健康检查

const DEFAULT_BASE_URL = 'http://localhost:3100';
const URL_TTL_MS = 10 * 60 * 1000;   // 播放直链通常 20 分钟内有效，提前刷新
const HEALTH_TTL_MS = 30 * 1000;

const urlCache = new Map(); // neteaseId -> { url, expiresAt }
let healthCache = { at: 0, available: false, error: null };

function baseUrl() {
  return (process.env.NETEASE_MUSIC_API_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

async function apiGet(path, params = {}, timeoutMs = 8000, cookie = '', allowedCodes = [200]) {
  // SDK 默认使用 PC 客户端 Cookie；播放接口保持同一客户端身份，不改写账号或地区。
  if (path === '/song/url/v1' || path === '/song/url') {
    params = { ...params, ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' };
  }
  if (process.env.NETEASE_EMBEDDED === '1') {
    embeddedApi ||= require('../../../music-api/node_modules/NeteaseCloudMusicApi/main.js');
    const method = { '/cloudsearch': 'cloudsearch', '/search': 'search', '/song/url/v1': 'song_url_v1', '/song/url': 'song_url', '/login/qr/key': 'login_qr_key', '/login/qr/create': 'login_qr_create', '/login/qr/check': 'login_qr_check', '/login/status': 'login_status' }[path];
    if (!method) throw new Error('不支持的音乐接口');
    let timer;
    try {
      const result = await Promise.race([embeddedApi[method]({ ...params, cookie }), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('音乐接口超时')), timeoutMs); })]);
      const json = result.body;
      if (result.status >= 400 || (json.code && !allowedCodes.includes(json.code))) throw new Error(json.message || json.msg || '音乐接口暂时不可用');
      return json;
    } finally { clearTimeout(timer); }
  }
  const url = new URL(path, baseUrl() + '/');
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { headers: cookie ? { Cookie: cookie } : undefined, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) {
    throw new Error(`网易云 API 返回 HTTP ${res.status}`);
  }
  const json = await res.json();
  if (json.code && !allowedCodes.includes(json.code)) {
    throw new Error(json.message || json.msg || `网易云 API 错误码 ${json.code}`);
  }
  return json;
}

const PLACEHOLDER_COVER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#1a1a1a"/><stop offset="1" stop-color="#2b2b2b"/>' +
      '</linearGradient></defs>' +
      '<rect width="300" height="300" fill="url(#g)"/>' +
      '<circle cx="150" cy="150" r="52" fill="none" stroke="#c8ff4d" stroke-width="2" opacity="0.55"/>' +
      '<circle cx="150" cy="150" r="10" fill="#c8ff4d" opacity="0.75"/>' +
      '</svg>'
  );

function normalizeSong(song) {
  const artists = (song.ar || song.artists || []).map(a => a.name).filter(Boolean);
  const album = song.al || song.album || {};
  const cover = (album.picUrl || '').replace(/^http:/, 'https:') || PLACEHOLDER_COVER;
  const durationMs = song.dt || song.duration || 0;
  const fee = song.fee;

  return {
    id: `ns-${song.id}`,
    source: 'netease',
    sourceId: song.id,
    title: song.name,
    artist: artists.join(' / ') || '未知艺术家',
    album: album.name || '',
    cover,
    src: `/api/music/stream/netease/${song.id}`,
    duration: Math.round(durationMs / 1000),
    tags: [],
    vip: fee === 1 || fee === 4,
  };
}

/**
 * 搜索网易云歌曲
 * @param {string} keywords
 * @param {number} limit
 * @returns {Promise<{tracks: Array, total: number}>}
 */
export async function search(keywords, limit = 20, offset = 0, cookie = '') {
  const json = await apiGet('/cloudsearch', { keywords, limit, offset, type: 1 }, 8000, cookie);
  const songs = json.result?.songs || [];
  return {
    tracks: songs.map(normalizeSong),
    total: json.result?.songCount ?? songs.length,
  };
}

/**
 * 解析歌曲播放直链（带缓存）
 * @param {string|number} neteaseId
 * @returns {Promise<string>}
 */
function cacheKey(id, cookie) {
  return createHash('sha256').update(cookie || 'anonymous').digest('hex').slice(0, 24) + ':' + id;
}
function cacheAudio(item, cookie) {
  if (!item?.url) return null;
  const value = { url: item.url.replace(/^http:/, 'https:'), preview: Boolean(item.freeTrialInfo),
    duration: Math.round((item.time || 0) / 1000), expiresAt: Date.now() + URL_TTL_MS };
  urlCache.set(cacheKey(String(item.id), cookie), value);
  if (urlCache.size > 500) urlCache.delete(urlCache.keys().next().value);
  return value;
}
export async function getPlayability(ids, cookie = '') {
  if (!ids.length) return new Map();
  const safeIds = ids.map(String).filter(id => /^\d+$/.test(id)).slice(0, 30);
  if (!safeIds.length) return new Map();
  const result = new Map(safeIds.map(id => [id, null]));
  try {
    const json = await apiGet('/song/url/v1', { id: safeIds.join(','), level: 'exhigh' }, 10000, cookie);
    for (const item of json.data || []) {
      if (result.has(String(item.id))) result.set(String(item.id), cacheAudio(item, cookie));
    }
  } catch { /* v1 不可用时尝试旧接口，仍遵守原账号的版权权限。 */ }
  // v1 即使返回 200，也可能只给部分歌曲空 URL；只补查缺失的歌曲，不覆盖已有音源。
  const missing = safeIds.filter(id => !result.get(id));
  if (missing.length) {
    try {
      const json = await apiGet('/song/url', { id: missing.join(','), br: 320000 }, 10000, cookie);
      for (const item of json.data || []) {
        if (result.has(String(item.id)) && !result.get(String(item.id))) result.set(String(item.id), cacheAudio(item, cookie));
      }
    } catch (error) {
      if (![...result.values()].some(Boolean)) throw error;
    }
  }
  return result;
}
export async function getStreamUrl(neteaseId, cookie = '') {
  const cached = urlCache.get(cacheKey(String(neteaseId), cookie));
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const result = await getPlayability([neteaseId], cookie);
  const item = result.get(String(neteaseId));
  if (!item) { const error = new Error('当前账号没有可用音源，可能受版权或会员限制'); error.code = 'NO_AUDIO'; throw error; }
  return item.url;
}
export function accountRequest(path, params = {}, cookie = '') {
  return apiGet(path, params, 10000, cookie, [200, 800, 801, 802, 803]);
}

/**
 * 健康检查（30 秒缓存）：服务是否在线可用
 */
export async function health(force = false) {
  const now = Date.now();
  if (!force && now - healthCache.at < HEALTH_TTL_MS) return healthCache;

  try {
    await apiGet('/search', { keywords: 'aurora', limit: 1 }, 3000);
    healthCache = { at: now, available: true, error: null };
  } catch (e) {
    healthCache = { at: now, available: false, error: e.message || '连接失败' };
  }
  return healthCache;
}

export function providerInfo() {
  return {
    id: 'netease',
    name: '网易云音乐',
    baseUrl: baseUrl(),
  };
}
