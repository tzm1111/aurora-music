import { hasSealedSessions, seal, unseal } from '../utils/sealedState.js';
import { requirePlayerOrigin } from '../middleware/playerOrigin.js';
// 音乐API路由
// - 本地曲库：内置数据 + 后端合成音频
// - 网易云：转发到本地 NeteaseCloudMusicApi（music-api/）
import { Router } from 'express';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { MUSIC_LIBRARY } from '../data/musicLibrary.js';
import * as netease from '../services/neteaseService.js';
import { musicCookie } from '../services/neteaseSession.js';

const router = Router();

function parseLimit(value, fallback = 20) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, 1), 50);
}

/**
 * GET /api/music/providers
 * 音源可用状态，供前端展示与降级判断
 */
router.get('/providers', async (req, res) => {
  const ns = await netease.health();
  res.json({
    success: true,
    providers: [
      {
        id: 'local',
        name: '本地曲库',
        available: true,
        count: MUSIC_LIBRARY.length,
        detail: '内置曲库 + 后端合成音源',
      },
      {
        ...netease.providerInfo(),
        available: ns.available,
        detail: ns.available
          ? '搜索与播放可用'
          : '未连接，请运行 npm run music-api（默认端口 3100）',
        error: ns.error,
      },
      {
        id: 'qq',
        name: 'QQ音乐',
        available: false,
        configured: Boolean(process.env.QQ_MUSIC_API_URL),
        detail: '暂未接入',
      },
    ],
  });
});

/**
 * GET /api/music/search
 * 搜索音乐
 * 查询参数: q 或 keywords（关键词）, limit（数量）, source = local | netease
 */
router.get('/search', async (req, res) => {
  const { q, keywords, source = 'local' } = req.query;
  const query = String(q || keywords || '').trim();
  const limit = parseLimit(req.query.limit);

  if (!query) {
    return res.status(400).json({
      success: false,
      error: { message: '请提供搜索关键词' },
    });
  }

  if (source === 'netease') {
    try {
      const { tracks, total } = await netease.search(query, limit, Math.max(0, Number.parseInt(req.query.offset, 10) || 0), musicCookie(req));
      return res.json({ success: true, source: 'netease', tracks, total });
    } catch (error) {
      console.error('网易云搜索错误:', error);
      return res.status(502).json({
        success: false,
        source: 'netease',
        error: { code: 'PROVIDER_ERROR', message: error.message || '网易云搜索失败' },
      });
    }
  }

  try {
    const lowered = query.toLowerCase();
    const results = MUSIC_LIBRARY.filter(track =>
      track.title.toLowerCase().includes(lowered) ||
      track.artist.toLowerCase().includes(lowered) ||
      track.album.toLowerCase().includes(lowered) ||
      track.tags.some(tag => tag.toLowerCase().includes(lowered)) ||
      track.genres.some(genre => genre.toLowerCase().includes(lowered))
    ).slice(0, limit);

    res.json({
      success: true,
      source: 'local',
      tracks: results,
      total: results.length,
    });
  } catch (error) {
    console.error('音乐搜索错误:', error);
    res.status(500).json({
      success: false,
      error: { message: '音乐搜索失败' },
    });
  }
});

// 分离部署的音频票据仅授权单首歌曲，不携带账号登录凭据。
router.get('/playback/netease/:id', requirePlayerOrigin, async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) return res.status(400).json({ success: false, error: { message: '非法的歌曲 ID' } });
  if (!hasSealedSessions()) return res.status(503).json({ success: false, error: { message: '分离部署会话未配置' } });
  try {
    const url = await netease.getStreamUrl(id, musicCookie(req));
    const ticket = seal({ id, url, expires: Date.now() + 5 * 60 * 1000 }, 'aurora-media');
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, src: `/api/music/stream/netease/${id}?ticket=${encodeURIComponent(ticket)}` });
  } catch (error) {
    // 不记录 SDK 原始错误对象，避免其请求配置携带账号 Cookie。
    const code = error.code === 'NO_AUDIO' ? 'NO_AUDIO' : 'PLAYBACK_ERROR';
    console.error('播放票据失败:', { id, code, errorType: error.name || 'ProviderError' });
    res.status(code === 'NO_AUDIO' ? 404 : 502).json({ success: false, error: {
      code, message: code === 'NO_AUDIO' ? '当前账号没有可用音源，可能受版权或会员限制。' : '音乐服务暂时无法获取音源，请稍后重试。',
    } });
  }
});

/**
 * GET /api/music/stream/netease/:id
 * 网易云音频流代理：解决跨域与直链过期问题，支持 Range 请求
 */
router.get('/stream/netease/:id', async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({
      success: false,
      error: { message: '非法的歌曲 ID' },
    });
  }

  let upstream;
  const controller = new AbortController();
  res.on('close', () => controller.abort());

  try {
    const media = req.query.ticket ? unseal(req.query.ticket, 'aurora-media') : null;
    if (req.query.ticket && (!media || media.id !== id)) return res.status(403).end();
    const url = media?.url || await netease.getStreamUrl(id, musicCookie(req));
    const headers = {};
    if (req.headers.range) headers.Range = req.headers.range;

    upstream = await fetch(url, { headers, signal: controller.signal });

    if (!upstream.ok && upstream.status !== 206) {
      throw new Error(`音源返回 HTTP ${upstream.status}`);
    }

    res.status(upstream.status);
    for (const key of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
      const value = upstream.headers.get(key);
      if (value) res.setHeader(key, value);
    }
    if (!res.getHeader('content-type')) res.setHeader('content-type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');

    if (!upstream.body) return res.end();
    await pipeline(Readable.fromWeb(upstream.body), res);
  } catch (error) {
    if (controller.signal.aborted || res.destroyed) return;
    if (error.name === 'AbortError') return res.end();
    console.error('音频流代理错误:', error);
    if (res.headersSent) return res.end();
    res.status(error.code === 'NO_AUDIO' ? 404 : 502).json({
      success: false,
      error: { code: error.code || 'STREAM_ERROR', message: error.message || '音频获取失败' },
    });
  }
});

/**
 * GET /api/music/library
 * 获取音乐库列表
 */
router.get('/library', (req, res) => {
  try {
    const { limit = 50 } = req.query;
    res.json({
      success: true,
      tracks: MUSIC_LIBRARY.slice(0, limit),
      total: MUSIC_LIBRARY.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: '获取音乐库失败' },
    });
  }
});

/**
 * GET /api/music/popular
 * 获取热门歌曲
 */
router.get('/popular', (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const popular = [...MUSIC_LIBRARY]
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, limit);

    res.json({
      success: true,
      tracks: popular,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: '获取热门歌曲失败' },
    });
  }
});

export { router as musicRouter };
