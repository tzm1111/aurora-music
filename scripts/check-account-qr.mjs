import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import http from 'node:http';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';

const source = await fs.readFile(new URL('../src/lib/accountPolling.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { pollAccountQR } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const original = { setTimeout, clearTimeout, now: Date.now };
let clock = 0, sequence = 0;
const jobs = new Map();
globalThis.setTimeout = (fn, delay) => { const id = ++sequence; jobs.set(id, { fn, at: clock + delay }); return id; };
globalThis.clearTimeout = id => jobs.delete(id);
Date.now = () => clock;
async function next() {
  assert.ok(jobs.size, '应该继续查询');
  const [id, job] = [...jobs.entries()].sort((a, b) => a[1].at - b[1].at)[0];
  jobs.delete(id); clock = job.at; await job.fn();
}
const status = name => ({ status: name, loggedIn: name === 'authorized', profile: null });
try {
  const messages = []; let authorized = 0;
  const steps = ['waiting', 'scanned', new Error('temporary outage'), 'unavailable', 'authorized'];
  pollAccountQR({ expiresAt: 180000, check: async () => { const value = steps.shift(); if (value instanceof Error) throw value; return status(value); }, onStatus: text => messages.push(text), onAuthorized: () => authorized++ });
  for (let i = 0; i < 5; i++) await next();
  assert.equal(authorized, 1); assert.equal(jobs.size, 0);
  assert.ok(messages.includes('已扫码，正在重新连接…'));
  assert.equal(messages.at(-1), '已连接');

  clock = 0; messages.length = 0;
  pollAccountQR({ expiresAt: 5000, check: async () => { throw new Error('offline'); }, onStatus: text => messages.push(text), onAuthorized: () => assert.fail('不应登录') });
  await next(); await next();
  assert.equal(clock, 5000); assert.match(messages.at(-1), /登录结果无法确认/); assert.equal(jobs.size, 0);

  clock = 0; let finish, calls = 0; messages.length = 0;
  const loop = pollAccountQR({ expiresAt: 180000, check: signal => { calls++; return new Promise(resolve => { finish = resolve; assert.equal(signal.aborted, false); }); }, onStatus: text => messages.push(text), onAuthorized: () => assert.fail('关闭后不能登录') });
  loop.resume(); loop.resume(); assert.equal(calls, 1, '回前台不能重叠请求');
  loop.stop(); finish(status('authorized')); await Promise.resolve(); await Promise.resolve();
  assert.equal(messages.length, 0); assert.equal(jobs.size, 0);

  clock = 0;
  pollAccountQR({ expiresAt: 1500, check: async () => status('authorized'), onStatus: text => messages.push(text), onAuthorized: () => authorized++ });
  await next(); assert.equal(authorized, 2); assert.equal(jobs.size, 0);
  pollAccountQR({ expiresAt: 180000, check: async () => status('expired'), onStatus: text => messages.push(text), onAuthorized: () => assert.fail() });
  await next(); assert.equal(jobs.size, 0); assert.match(messages.at(-1), /已过期/);
  console.log('通过：扫码后断网与异常状态自动恢复、保留已扫码提示、退避至过期、回前台立即查询且不重叠、关闭后拒绝迟到结果。');
} finally { globalThis.setTimeout = original.setTimeout; globalThis.clearTimeout = original.clearTimeout; Date.now = original.now; }

process.env.AURORA_SESSION_SECRET = randomBytes(32).toString('hex');
process.env.APP_ORIGIN = 'https://qr-test.example';
process.env.NETEASE_EMBEDDED = '0';
let upstreamCookie = 'test-private-cookie';
let upstreamCode = 801, qrFails = false, profileFails = false, upstreamCalls = 0;
const upstream = http.createServer((req, res) => {
  upstreamCalls++;
  assert.equal(new URL(req.url, 'http://localhost').searchParams.get('noCookie'), 'true');
  const path = new URL(req.url, 'http://localhost').pathname;
  let data;
  if (path === '/login/qr/key') data = { code: 200, data: { unikey: 'test-qr-key' } };
  else if (path === '/login/qr/create') data = qrFails ? { code: 500 } : { code: 200, data: { qrimg: 'data:image/png;base64,test' } };
  else if (path === '/login/qr/check') data = { code: upstreamCode, ...(Number(upstreamCode) === 803 ? { cookie: upstreamCookie } : {}) };
  else if (path === '/login/status') data = profileFails ? { code: 500 } : { code: 200, data: { profile: { nickname: 'Test', vipType: 11 } } };
  else throw new Error('Unexpected request');
  res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data));
});
upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
process.env.NETEASE_MUSIC_API_URL = `http://127.0.0.1:${upstream.address().port}`;
const { default: app } = await import('../server/src/app.js');
const { unseal, seal } = await import('../server/src/utils/sealedState.js');
const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
async function post(route, token) {
  return fetch(base + '/api/account/' + route, { method: 'POST', headers: { Origin: process.env.APP_ORIGIN, 'Content-Type': 'application/json', ...(token ? { 'X-Aurora-Session': token } : {}) }, body: '{}' });
}
try {
  const qr = await post('qr'); assert.equal(qr.status, 200);
  const token = qr.headers.get('x-aurora-session'); assert.ok(token);
  const challenge = unseal(token, 'aurora-session'); assert.equal(challenge.qrKey, 'test-qr-key');
  for (const [code, expected] of [[801, 'waiting'], [802, 'scanned'], [800, 'expired']]) {
    upstreamCode = code; const result = await post('check', token); assert.equal((await result.json()).status, expected);
  }
  upstreamCode = 500;
  const failed = await post('check', token); assert.equal(failed.status, 502);
  assert.equal((await failed.json()).error.code, 'NETEASE_CODE_500');
  upstreamCode = 802; assert.equal((await (await post('check', token)).json()).status, 'scanned');
  qrFails = true;
  const refresh = await post('qr', token); assert.equal(refresh.status, 502);
  assert.equal(refresh.headers.get('x-aurora-session'), null, '刷新失败不覆盖有效二维码');
  qrFails = false; profileFails = true; upstreamCode = 803;
  const auth = await post('check', token); const account = await auth.json();
  assert.equal(account.status, 'authorized'); assert.equal(account.loggedIn, true); assert.equal(account.profile, null);
  assert.ok(!JSON.stringify(account).includes('test-private-cookie'));
  const savedToken = auth.headers.get('x-aurora-session');
  const count = upstreamCalls;
  assert.equal((await (await post('check', savedToken)).json()).status, 'authorized');
  assert.equal(upstreamCalls, count, '成功后重复查询不再访问已失效二维码');
  upstreamCode = '803'; upstreamCookie = 'MUSIC_U=' + 'a'.repeat(4200);
  const delayedToken = seal({ ...challenge, qrExpires: Date.now() - 5000 }, 'aurora-session');
  const delayed = await post('check', delayedToken); const delayedBody = await delayed.json();
  assert.equal(delayedBody.status, 'authorized', '截止时仍能取回网易云已确认的真实授权');
  assert.equal(delayed.headers.get('x-aurora-session'), null);
  assert.ok(delayed.headers.get('set-cookie').length < 300);
  assert.equal(unseal(delayedBody.connectionToken, 'aurora-session').cookie, upstreamCookie);
  assert.equal((await (await post('check', delayedBody.connectionToken)).json()).loggedIn, true);
  const lost = await post('check'); assert.equal((await lost.json()).status, 'session_lost');
  console.log('通过：较大真实格式登录凭证仅用加密响应体、截止时取回迟到授权、缺失会话不误报过期、内部接口禁止重复Cookie头。');
  const logout = await post('logout', savedToken); assert.equal(logout.status, 200);
  console.log('通过：HTTP 扫码等待/确认/过期、上游502后再次查询、刷新失败保留凭证、资料查询失败仍登录、加密保存且不泄漏Cookie、成功后重复查询。');
} finally { await Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => upstream.close(resolve))]); }
