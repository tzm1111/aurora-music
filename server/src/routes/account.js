import { Router } from 'express';
import { getMusicSession, clearMusicSession } from '../services/neteaseSession.js';
import { accountRequest } from '../services/neteaseService.js';
import { requirePlayerOrigin } from '../middleware/playerOrigin.js';
const router = Router();
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.use(requirePlayerOrigin);
router.get('/status', (req, res) => {
  const session = getMusicSession(req);
  res.json({ success: true, loggedIn: Boolean(session?.cookie), profile: session?.profile || null });
});
router.post('/qr', async (req, res) => {
  try {
    const session = getMusicSession(req, res, true);
    const key = await accountRequest('/login/qr/key', { timestamp: Date.now() });
    if (!key.data?.unikey) throw new Error('登录二维码暂时不可用');
    const qr = await accountRequest('/login/qr/create', { key: key.data.unikey, qrimg: true, timestamp: Date.now() });
    if (!qr.data?.qrimg) throw new Error('二维码生成失败');
    session.qrKey = key.data.unikey;
    session.qrExpires = Date.now() + 3 * 60 * 1000;
    res.json({ success: true, image: qr.data.qrimg, expiresAt: session.qrExpires });
  } catch { res.status(502).json({ success: false, error: { message: '网易云登录暂时不可用，请稍后重试。' } }); }
});
router.post('/check', async (req, res) => {
  const session = getMusicSession(req);
  // 成功响应丢失后的重试仍返回已连接，避免清空 qrKey 后被误判为过期。
  if (session?.cookie && !session.qrKey) return res.json({ success: true, status: 'authorized', loggedIn: true, profile: session.profile || null });
  if (!session?.qrKey || session.qrExpires < Date.now()) return res.json({ success: true, status: 'expired' });
  try {
    const data = await accountRequest('/login/qr/check', { key: session.qrKey, timestamp: Date.now() });
    const code = Number(data.code);
    if (code === 803 && data.cookie) {
      session.cookie = data.cookie;
      session.qrKey = '';
      try {
        const account = await accountRequest('/login/status', {}, session.cookie, 3000);
        const p = account.data?.profile;
        session.profile = p ? { nickname: p.nickname, avatarUrl: p.avatarUrl, vipType: p.vipType } : null;
      } catch { session.profile = null; }
      return res.json({ success: true, status: 'authorized', loggedIn: true, profile: session.profile });
    }
    res.json({ success: true, status: code === 800 ? 'expired' : code === 802 ? 'scanned' : code === 801 ? 'waiting' : 'unavailable' });
  } catch { res.status(502).json({ success: false, error: { code: 'QR_CHECK_RETRY', message: '扫码状态查询暂时失败，正在重试。' } }); }
});
router.post('/logout', (req, res) => {
  const session = getMusicSession(req);
  if (session) { session.cookie = ''; session.profile = null; session.qrKey = ''; session.qrExpires = 0; }
  if (!session?.model) clearMusicSession(req, res);
  res.json({ success: true });
});
export { router as accountRouter };
