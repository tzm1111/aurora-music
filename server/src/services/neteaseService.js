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

// 可选：配置自己的网易云 cookie（MUSIC_U）以播放有权限的会员歌曲
// 不配置时匿名访问：普通歌曲完整播放，VIP 歌曲仅 30 秒试听
function userCookie() {
  return (process.env.NETEASE_COOKIE || '').trim();
}

async function apiGet(path, params = {}, timeoutMs = 8000) {
  const url = new URL(path, baseUrl() + '/');
  const cookie = userCookie();
  if (cookie) url.searchParams.set('cookie', cookie);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) {
    throw new Error(`网易云 API 返回 HTTP ${res.status}`);
  }
  const json = await res.json();
  if (json.code && json.code !== 200) {
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
    tags: ['CN'],
    region: 'CN',
    vip: fee === 1 || fee === 4,
  };
}

/**
 * 搜索网易云歌曲
 * @param {string} keywords
 * @param {number} limit
 * @returns {Promise<{tracks: Array, total: number}>}
 */
export async function search(keywords, limit = 20) {
  const json = await apiGet('/cloudsearch', { keywords, limit, type: 1 });
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
export async function getStreamUrl(neteaseId) {
  const key = String(neteaseId);
  const cached = urlCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const json = await apiGet('/song/url', { id: key, br: 320000 }, 10000);
  const item = Array.isArray(json.data) ? json.data[0] : null;

  if (!item || !item.url) {
    const err = new Error('该歌曲暂无可用音源（可能受版权或会员限制）');
    err.code = 'NO_AUDIO';
    throw err;
  }

  const url = item.url.replace(/^http:/, 'https:');
  urlCache.set(key, { url, expiresAt: Date.now() + URL_TTL_MS });
  return url;
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
