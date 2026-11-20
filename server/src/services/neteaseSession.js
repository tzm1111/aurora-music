import { randomBytes } from 'node:crypto';
import { hasSealedSessions, seal, unseal } from '../utils/sealedState.js';
const sessions = new Map();
const TTL = 30 * 24 * 60 * 60 * 1000;
export function getMusicSession(req, res, create = false) {
  const now = Date.now();
  if (hasSealedSessions()) {
    if (!req.auroraSessionLoaded) {
      const cookieToken = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('aurora_session='))?.slice(15);
      req.auroraSession = unseal(req.headers['x-aurora-session'], 'aurora-session') || unseal(cookieToken, 'aurora-session');
      req.auroraSessionLoaded = true;
    }
    if (!req.auroraSession && create) req.auroraSession = { id: randomBytes(32).toString('base64url'), cookie: '', qrKey: '', qrExpires: 0, profile: null, expires: now + TTL };
    return req.auroraSession || null;
  }
  for (const [key, value] of sessions) if (value.expires < now) sessions.delete(key);
  const id = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('aurora_session='))?.slice('aurora_session='.length);
  let session = id && sessions.get(id);
  if (!session && create) {
    if (sessions.size >= 200) throw new Error('登录会话已满，请稍后再试');
    const nextId = randomBytes(32).toString('base64url');
    session = { id: nextId, cookie: '', qrKey: '', qrExpires: 0, profile: null, expires: now + TTL };
    sessions.set(nextId, session);
    res.cookie('aurora_session', nextId, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: TTL });
  }
  return session || null;
}
export function musicCookie(req) { return getMusicSession(req)?.cookie || ''; }
export function clearMusicSession(req, res) {
  const session = getMusicSession(req);
  if (hasSealedSessions()) { req.auroraSession = null; req.auroraSessionLoaded = true; }
  else if (session) sessions.delete(session.id);
  res.clearCookie('aurora_session', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
  res.set('X-Aurora-Session', '');
}

// 浏览器持有加密连接凭证，持续使用时续期；同一服务的实例共享固定密钥。
export function persistMusicSession(req, res, next) {
  if (process.env.VERCEL && !hasSealedSessions()) return res.status(503).json({ success: false, error: { message: '服务器会话配置尚未完成。' } });
  if (hasSealedSessions()) {
    const original = JSON.stringify(getMusicSession(req));
    const sendJson = res.json;
    res.json = function (body) {
      const session = getMusicSession(req);
      if (session) res.set('Cache-Control', 'no-store');
      if (session && session.expires < Date.now() + TTL / 2) session.expires = Date.now() + TTL;
      if (session && JSON.stringify(session) !== original) {
        const token = seal(session, 'aurora-session');
        res.set('X-Aurora-Session', token);
        res.cookie('aurora_session', token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: Math.max(0, session.expires - Date.now()) });
      }
      return sendJson.call(this, body);
    };
  }
  next();
}
