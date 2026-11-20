import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { seal, unseal, initializeSessionSecret } from '../server/src/utils/sealedState.js';
import { getMusicSession, persistMusicSession } from '../server/src/services/neteaseSession.js';
import { mkdtemp, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
process.env.AURORA_SESSION_SECRET = randomBytes(32).toString('hex');
const original = { id: 'test', cookie: 'private-test-cookie', expires: Date.now() + 60000 };
const token = seal(original, 'aurora-session');
assert.deepEqual(unseal(token, 'aurora-session'), original);
assert.equal(unseal(token, 'aurora-media'), null);
assert.equal(unseal(token.slice(0, -8), 'aurora-session'), null);
assert.equal(unseal(seal({ expires: Date.now() - 1 }, 'aurora-session'), 'aurora-session'), null);
assert.equal(Buffer.from(token, 'base64url').includes(Buffer.from(original.cookie)), false);
const req = { headers: { 'x-aurora-session': token } };
const headers = {};
const res = { set: (key, value) => { headers[key] = value; }, cookie: () => {}, json: body => body };
persistMusicSession(req, res, () => {});
getMusicSession(req).cookie = 'updated-test-cookie';
res.json({ success: true });
assert.equal(unseal(headers['X-Aurora-Session'], 'aurora-session').cookie, 'updated-test-cookie');
assert.ok(unseal(headers['X-Aurora-Session'], 'aurora-session').expires > Date.now() + 29 * 24 * 60 * 60 * 1000);
// 模拟另外一台实例，不依赖原实例的内存表。
assert.equal(getMusicSession({ headers: { 'x-aurora-session': headers['X-Aurora-Session'] } }).cookie, 'updated-test-cookie');
const cookieReq = { headers: { cookie: 'aurora_session=' + headers['X-Aurora-Session'] } };
assert.equal(getMusicSession(cookieReq).cookie, 'updated-test-cookie');
process.env.AURORA_SESSION_SECRET = randomBytes(32).toString('hex');
assert.equal(unseal(token, 'aurora-session'), null);
console.log('通过：加密会话、篡改与过期拒绝、用途隔离、实例切换与 Cookie 兼容。');

const dir = await mkdtemp(path.join(tmpdir(), 'aurora-key-test-'));
const previousFile = process.env.AURORA_SESSION_KEY_FILE;
process.env.AURORA_SESSION_KEY_FILE = path.join(dir, 'session.key');
try {
  delete process.env.AURORA_SESSION_SECRET;
  initializeSessionSecret();
  const durable = seal(original, 'aurora-session');
  delete process.env.AURORA_SESSION_SECRET;
  initializeSessionSecret();
  assert.deepEqual(unseal(durable, 'aurora-session'), original);
  assert.equal((await stat(process.env.AURORA_SESSION_KEY_FILE)).mode & 0o777, 0o600);
  console.log('通过：服务重启复用密钥文件、私密文件权限。');
} finally {
  await rm(dir, { recursive: true, force: true });
  if (previousFile) process.env.AURORA_SESSION_KEY_FILE = previousFile;
  else delete process.env.AURORA_SESSION_KEY_FILE;
}

process.env.NODE_ENV = 'production';
process.env.APP_ORIGIN = 'https://player.example';
const { default: app } = await import('../server/src/app.js');
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const remembered = {
  id: 'remembered-test', cookie: 'private-test-cookie', qrKey: '', profile: { nickname: 'Test' },
  model: { provider: 'deepseek', apiKey: 'private-test-key' }, expires: Date.now() + 60_000,
};
const originalToken = seal(remembered, 'aurora-session');
async function request(route, token, method = 'GET') {
  return fetch(base + route, { method, headers: { Origin: process.env.APP_ORIGIN, 'X-Aurora-Session': token, 'Content-Type': 'application/json' }, ...(method === 'POST' ? { body: '{}' } : {}) });
}
try {
  const status = await request('/api/dj/status', originalToken);
  const data = await status.json();
  assert.equal(data.saved, true); assert.equal(data.provider, 'deepseek');
  assert.ok(!JSON.stringify(data).includes('private-test-key'));
  assert.match(status.headers.get('set-cookie'), /HttpOnly/);
  assert.match(status.headers.get('set-cookie'), /Secure/);
  const renewed = status.headers.get('x-aurora-session');
  const account = await request('/api/account/status', renewed);
  assert.equal((await account.json()).loggedIn, true);
  const logout = await request('/api/account/logout', renewed, 'POST');
  const modelOnly = unseal(logout.headers.get('x-aurora-session'), 'aurora-session');
  assert.equal(modelOnly.cookie, ''); assert.equal(modelOnly.model.apiKey, 'private-test-key');
  const clearModel = await request('/api/dj/model/clear', renewed, 'POST');
  const accountOnly = unseal(clearModel.headers.get('x-aurora-session'), 'aurora-session');
  assert.equal(accountOnly.cookie, 'private-test-cookie'); assert.equal(accountOnly.model, undefined);
  const clearAll = await request('/api/account/logout', clearModel.headers.get('x-aurora-session'), 'POST');
  assert.equal(clearAll.headers.get('x-aurora-session'), '');
  assert.match(clearAll.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
  console.log('通过：正常 HTTP 入口恢复账号和模型、30天续期、模型状态不返回Key、单独退出/清除与最后连接清除。');
} finally {
  await new Promise(resolve => server.close(resolve));
}
