export function playerOrigins() {
  const allowed = new Set();
  for (const value of [process.env.APP_ORIGIN, process.env.RENDER_EXTERNAL_URL, ...(process.env.PLAYER_ORIGINS || '').split(',')]) {
    if (value) { try { allowed.add(new URL(value).origin); } catch { /* 忽略无效来源 */ } }
  }
  if (process.env.NODE_ENV !== 'production') { allowed.add('http://127.0.0.1:5173'); allowed.add('http://localhost:5173'); }
  return allowed;
}

// 同源网页操作支持本地 HTTP 和托管平台 HTTPS，拒绝跨站账号与模型操作。
export function requirePlayerOrigin(req, res, next) {
  const origin = req.headers.origin;
  const allowed = playerOrigins();
  allowed.add(`${req.protocol}://${req.headers.host}`);
  if (process.env.NODE_ENV !== 'production') {
    allowed.add('http://127.0.0.1:5173'); allowed.add('http://localhost:5173');
  }
  if (origin && !allowed.has(origin)) return res.status(403).json({ success: false, error: { message: '请从播放器页面操作' } });
  next();
}
