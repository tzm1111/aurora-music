import { Router } from 'express';
import { getMusicSession } from '../services/neteaseSession.js';
import { accountRequest } from '../services/neteaseService.js';
const router = Router();
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const origin = req.headers.origin;
  const allowed = new Set(['http://127.0.0.1:5173', 'http://localhost:5173', `http://${req.headers.host}`]);
  if (origin && !allowed.has(origin)) return res.status(403).json({ success: false, error: { message: '请从播放器页面操作账号' } });
  next();
});
router.get('/status', (req, res) => {
  const session = getMusicSession(req);
  res.json({ success: true, loggedIn: Boolean(session?.cookie), profile: session?.profile || null });
});
router.post('/qr', async (req, res) => {
  try {
    const session = getMusicSession(req, res, true);
    const key = await accountRequest('/login/qr/key', { timestamp: Date.now() });
    if (!key.data?.unikey) throw new Error('登录二维码暂时不可用');
    session.qrKey = key.data.unikey;
    session.qrExpires = Date.now() + 3 * 60 * 1000;
    const qr = await accountRequest('/login/qr/create', { key: session.qrKey, qrimg: true, timestamp: Date.now() });
    if (!qr.data?.qrimg) throw new Error('二维码生成失败');
    res.json({ success: true, image: qr.data.qrimg, expiresAt: session.qrExpires });
  } catch { res.status(502).json({ success: false, error: { message: '网易云登录暂时不可用，请稍后重试。' } }); }
});
router.post('/check', async (req, res) => {
  const session = getMusicSession(req);
  if (!session?.qrKey || session.qrExpires < Date.now()) return res.json({ success: true, status: 'expired' });
  try {
    const data = await accountRequest('/login/qr/check', { key: session.qrKey, timestamp: Date.now() });
    if (data.code === 803 && data.cookie) {
      session.cookie = data.cookie;
      session.qrKey = '';
      try {
        const account = await accountRequest('/login/status', {}, session.cookie);
        const p = account.data?.profile;
        session.profile = p ? { nickname: p.nickname, avatarUrl: p.avatarUrl, vipType: p.vipType } : null;
      } catch { session.profile = null; }
      return res.json({ success: true, status: 'authorized', loggedIn: true, profile: session.profile });
    }
    res.json({ success: true, status: data.code === 800 ? 'expired' : data.code === 802 ? 'scanned' : data.code === 801 ? 'waiting' : 'unavailable' });
  } catch { res.status(502).json({ success: false, error: { message: '无法检查扫码状态，请重新生成二维码。' } }); }
});
router.post('/logout', (req, res) => { const session = getMusicSession(req); if (session) { session.cookie = ''; session.profile = null; session.qrKey = ''; } res.json({ success: true }); });
export { router as accountRouter };
