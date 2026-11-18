// 同源网页操作支持本地 HTTP 和托管平台 HTTPS，拒绝跨站账号与模型操作。
export function requirePlayerOrigin(req, res, next) {
  const origin = req.headers.origin;
  const configured = process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL;
  const allowed = new Set([`${req.protocol}://${req.headers.host}`]);
  if (configured) { try { allowed.add(new URL(configured).origin); } catch { /* 无效配置不扩展来源 */ } }
  if (process.env.NODE_ENV !== 'production') {
    allowed.add('http://127.0.0.1:5173'); allowed.add('http://localhost:5173');
  }
  if (origin && !allowed.has(origin)) return res.status(403).json({ success: false, error: { message: '请从播放器页面操作' } });
  next();
}
