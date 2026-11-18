import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
const root = fileURLToPath(new URL('../', import.meta.url));
const reserve = net.createServer();
reserve.listen(0, '127.0.0.1'); await once(reserve, 'listening');
const port = reserve.address().port;
await new Promise(resolve => reserve.close(resolve));
const child = spawn(process.execPath, ['server/src/index.js'], { cwd: root, stdio: 'ignore', env: { ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port), SERVE_STATIC: '1', LLM_PROVIDER: 'disabled', APP_ORIGIN: 'https://aurora-test.onrender.com' } });
const base = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null) throw new Error('生产服务启动失败');
    try { ready = (await fetch(base + '/api/health')).ok; } catch { /* 等待监听端口 */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, '生产服务启动超时');
  const page = await fetch(base); assert.equal(page.status, 200);
  const html = await page.text(); assert.match(html, /Aurora Music/);
  const js = html.match(/src="([^"]+\.js)"/)[1];
  const asset = await fetch(base + js); assert.equal(asset.status, 200); assert.match(asset.headers.get('content-type'), /javascript/);
  assert.equal((await fetch(base + '/djplaylists')).status, 200);
  assert.equal((await fetch(base + '/api/not-found')).status, 404);
  assert.equal((await fetch(base + '/missing.js')).status, 404);
  assert.equal((await fetch(base + '/api/account/status', { headers: { Origin: 'https://aurora-test.onrender.com' } })).status, 200);
  assert.equal((await fetch(base + '/api/account/status', { headers: { Origin: 'https://example.org' } })).status, 403);
  assert.equal((await fetch(base + '/api/dj/status', { headers: { Origin: 'http://localhost:5173' } })).status, 403);
  assert.equal((await fetch(base + '/api/dj/status', { headers: { Origin: 'https://aurora-test.onrender.com' } })).status, 200);
  const { getMusicSession } = await import('../server/src/services/neteaseSession.js');
  process.env.NODE_ENV = 'production';
  getMusicSession({ headers: {} }, { cookie: (_, __, options) => { assert.equal(options.secure, true); assert.equal(options.httpOnly, true); assert.equal(options.sameSite, 'strict'); } }, true);
  console.log('通过：生产网页与静态资源、页面回退、API/资源 404、HTTPS 同源、跨站拒绝、Secure 会话 Cookie。');
} finally {
  const exited = once(child, 'exit'); child.kill('SIGTERM');
  const kill = setTimeout(() => child.kill('SIGKILL'), 3000); kill.unref();
  await exited; clearTimeout(kill);
}
