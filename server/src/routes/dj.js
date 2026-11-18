import { Router } from 'express';
import { createDJSet } from '../services/djEngine.js';
import { djModelStatus, callDJPlan } from '../services/llmService.js';
import { musicCookie, getMusicSession } from '../services/neteaseSession.js';
const router = Router();
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const origin = req.headers.origin;
  if (origin && !['http://127.0.0.1:5173', 'http://localhost:5173', `http://${req.headers.host}`].includes(origin)) return res.status(403).json({ success: false, error: { message: '请从播放器页面操作' } });
  next();
});
router.post('/model', async (req, res) => {
  const { provider, apiKey, model } = req.body || {};
  if (!['openai', 'deepseek', 'gemini', 'claude'].includes(provider) || typeof apiKey !== 'string' || apiKey.length < 10 || apiKey.length > 512 || (model && (typeof model !== 'string' || model.length > 100))) return res.status(400).json({ success: false, error: { message: '请选择模型，并填写有效的 API Key。' } });
  try {
    const settings = { provider, apiKey, model: model || undefined };
    if (!await callDJPlan('放松的纯音乐', null, settings)) return res.status(502).json({ success: false, error: { message: '模型连接失败，请检查 Key、额度和模型可用性。' } });
    const session = getMusicSession(req, res, true);
    session.model = settings;
    res.json({ success: true, provider, available: true });
  } catch { res.status(503).json({ success: false, error: { message: '暂时无法创建连接。' } }); }
});

router.get('/status', (req, res) => res.json({ success: true, ...djModelStatus(getMusicSession(req)?.model) }));
router.post('/session', async (req, res) => {
  const { description, previous, excludeIds, recentTracks, offset } = req.body || {};
  if (typeof description !== 'string' || !description.trim() || description.length > 300) return res.status(400).json({ success: false, error: { message: '请用 1 到 300 字描述心情或场景。' } });
  const previousPlan = previous && typeof previous.description === 'string' ? { description: previous.description.slice(0, 300) } : null;
  const ids = Array.isArray(excludeIds) ? excludeIds.filter(id => typeof id === 'string').slice(-80) : [];
  const recent = Array.isArray(recentTracks) ? recentTracks.filter(track => track && typeof track.title === 'string').slice(0, 100).map(track => ({ title: track.title.slice(0, 200), artist: typeof track.artist === 'string' ? track.artist.slice(0, 200) : '' })) : [];
  try {
    const result = await createDJSet({ description: description.trim(), previous: previousPlan, excludeIds: ids, recentTracks: recent,
      cookie: musicCookie(req), modelSettings: getMusicSession(req)?.model, offset: Math.min(240, Math.max(0, Number.parseInt(offset, 10) || 0)) });
    if (!res.destroyed) res.json(result);
  } catch (error) {
    if (!res.destroyed) res.status(502).json({ success: false, error: { message: error.message || 'DJ 暂时无法连接音乐服务，请重试。' } });
  }
});
export { router as djRouter };
