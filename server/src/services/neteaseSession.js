import { randomBytes } from 'node:crypto';
const sessions = new Map();
const TTL = 24 * 60 * 60 * 1000;
export function getMusicSession(req, res, create = false) {
  const now = Date.now();
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
  if (session) sessions.delete(session.id);
  res.clearCookie('aurora_session', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
}
