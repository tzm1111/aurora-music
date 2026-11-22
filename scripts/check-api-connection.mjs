import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

// 在无真实账号/凭据的环境中检查前端连接与取消语义。
const input = await fs.readFile(new URL('../src/services/api.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(input.replace('import.meta.env?.VITE_API_BASE_URL', "'https://backend.example'"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const originalFetch = globalThis.fetch;
const originalTimeout = AbortSignal.timeout;
const stored = new Map();
const temporary = new Map();
globalThis.localStorage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) };
globalThis.sessionStorage = { getItem: key => temporary.get(key) ?? null, setItem: (key, value) => temporary.set(key, value), removeItem: key => temporary.delete(key) };
const { searchTracks, apiRequest, resolveAudioSource } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
try {
  let options;
  globalThis.fetch = async (url, init) => {
    options = init;
    assert.ok(url.startsWith('https://backend.example/api/'));
    return new Response(JSON.stringify({ success: true, tracks: [], total: 0 }), { headers: { 'X-Aurora-Session': 'test-sealed-session' } });
  };
  await searchTracks('netease', 'test');
  assert.equal(options.credentials, 'omit');
  assert.ok(options.signal instanceof AbortSignal);
  await apiRequest('/api/dj/session', { description: 'test' });
  assert.equal(options.headers.get('X-Aurora-Session'), 'test-sealed-session');
  assert.equal(options.credentials, 'omit');
  const storageKey = 'aurora-backend-session:https://backend.example';
  assert.equal(stored.get(storageKey), 'test-sealed-session');
  assert.equal(temporary.has(storageKey), false);
  temporary.clear();
  const reopened = await import('data:text/javascript;base64,' + Buffer.from(code + '\n// reopened browser').toString('base64'));
  await reopened.apiRequest('/api/dj/status');
  assert.equal(options.headers.get('X-Aurora-Session'), 'test-sealed-session');
  stored.clear(); temporary.set(storageKey, 'legacy-encrypted-token');
  globalThis.fetch = async (_url, init) => {
    options = init;
    return new Response(JSON.stringify({ success: true }));
  };
  await reopened.apiRequest('/api/dj/status');
  assert.equal(options.headers.get('X-Aurora-Session'), 'legacy-encrypted-token');
  assert.equal(stored.get(storageKey), 'legacy-encrypted-token');
  assert.equal(temporary.has(storageKey), false);

  let releaseStatus;
  globalThis.fetch = async url => {
    if (url.endsWith('/api/account/status')) return new Promise(resolve => { releaseStatus = resolve; });
    return new Response(JSON.stringify({ success: true }), { headers: { 'X-Aurora-Session': 'new-model-token' } });
  };
  const staleStatus = reopened.apiRequest('/api/account/status');
  await reopened.apiRequest('/api/dj/model', { provider: 'deepseek', apiKey: 'private-test-key' });
  releaseStatus(new Response(JSON.stringify({ success: true }), { headers: { 'X-Aurora-Session': 'stale-status-token' } }));
  await staleStatus;
  assert.equal(stored.get(storageKey), 'new-model-token');
  assert.ok(![...stored.values()].some(value => value.includes('private-test-key')));

  const connectionCalls = [];
  let releaseAccount;
  globalThis.fetch = async (url, init) => {
    connectionCalls.push(url);
    if (url.endsWith('/api/account/check')) return new Promise(resolve => { releaseAccount = resolve; });
    assert.equal(init.headers.get('X-Aurora-Session'), 'account-authorized-token');
    return new Response(JSON.stringify({ success: true }), { headers: { 'X-Aurora-Session': 'combined-account-model-token' } });
  };
  const authorize = reopened.apiRequest('/api/account/check', {});
  const connect = reopened.apiRequest('/api/dj/model', { provider: 'deepseek', apiKey: 'private-test-key' });
  await Promise.resolve();
  assert.equal(connectionCalls.length, 1);
  releaseAccount(new Response(JSON.stringify({ success: true }), { headers: { 'X-Aurora-Session': 'account-authorized-token' } }));
  await Promise.all([authorize, connect]);
  assert.equal(stored.get(storageKey), 'combined-account-model-token');

  globalThis.fetch = async url => {
    if (url.endsWith('/api/account/status')) return new Promise(resolve => { releaseStatus = resolve; });
    return new Response(JSON.stringify({ success: true }), { headers: { 'X-Aurora-Session': '' } });
  };
  const staleAfterClear = reopened.apiRequest('/api/account/status');
  await reopened.apiRequest('/api/dj/model/clear', {});
  releaseStatus(new Response(JSON.stringify({ success: true }), { headers: { 'X-Aurora-Session': 'must-not-restore-token' } }));
  await staleAfterClear;
  assert.equal(stored.has(storageKey), false);
  const cancelledCheck = new AbortController();
  globalThis.fetch = async () => {
    cancelledCheck.abort();
    return new Response(JSON.stringify({ success: true }), { headers: { 'X-Aurora-Session': 'cancelled-qr-token' } });
  };
  await assert.rejects(reopened.apiRequest('/api/account/check', {}, cancelledCheck.signal), { name: 'AbortError' });
  assert.equal(stored.has(storageKey), false, '关闭/刷新后的响应不能保存旧二维码凭证');
  let requests = 0, releaseQueued;
  globalThis.fetch = async () => { requests++; return new Promise(resolve => { releaseQueued = resolve; }); };
  const generating = reopened.apiRequest('/api/account/qr', {});
  const queuedController = new AbortController();
  const queued = reopened.apiRequest('/api/account/check', {}, queuedController.signal);
  const rejection = assert.rejects(queued, { name: 'AbortError' });
  await Promise.resolve(); queuedController.abort();
  releaseQueued(new Response(JSON.stringify({ success: true })));
  await Promise.all([generating, rejection]);
  assert.equal(requests, 1, '排队中的旧扫码查询取消后不能再发送');
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, status: 'authorized', loggedIn: true, connectionToken: 'body-only-authorized-token' }));
  const bodyAuthorization = await reopened.apiRequest('/api/account/check', {});
  assert.equal(stored.get(storageKey), 'body-only-authorized-token');
  assert.equal(bodyAuthorization.connectionToken, undefined, '凭证由请求封装保存，不交给界面显示');
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.headers.get('X-Aurora-Session'), 'body-only-authorized-token');
    return new Response(JSON.stringify({ success: true }));
  };
  await reopened.apiRequest('/api/account/status');
  console.log('通过：托管代理移除自定义响应头后，JSON 中的加密登录凭证仍能保存并用于下一次查询。');
  console.log('通过：已取消扫码响应不保存旧凭证、排队查询取消后不再发送。');
  console.log('通过：关闭后恢复加密连接、旧临时凭证迁移、迟到查询不覆盖新连接、扫码与模型保存依次执行、清除连接不被恢复。');
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(searchTracks('netease', 'test'), /无法连接音乐服务/);
  AbortSignal.timeout = () => AbortSignal.abort(new DOMException('Timeout', 'TimeoutError'));
  globalThis.fetch = async (_url, init) => { throw init.signal.reason; };
  await assert.rejects(searchTracks('netease', 'test'), /响应超时/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(searchTracks('netease', 'test', 24, controller.signal), { name: 'AbortError' });
  AbortSignal.timeout = originalTimeout;
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, src: '/api/music/stream/netease/1?ticket=test' }));
  assert.equal(await resolveAudioSource('/api/music/stream/netease/1'), 'https://backend.example/api/music/stream/netease/1?ticket=test');
  console.log('通过：跨域会话、请求超时、取消语义、网络提示与播放票据地址。');
} finally {
  globalThis.fetch = originalFetch;
  AbortSignal.timeout = originalTimeout;
  delete globalThis.sessionStorage;
  delete globalThis.localStorage;
}

// 上游 200 + 空 URL 也要回退；不覆盖已有权限音源，不伪造试听/版权结果。
process.env.NETEASE_EMBEDDED = '0';
process.env.NETEASE_MUSIC_API_URL = 'http://provider.example';
const { getPlayability } = await import('../server/src/services/neteaseService.js');
const calls = [];
try {
  globalThis.fetch = async url => {
    calls.push(url);
    assert.match(url.searchParams.get('ua'), /Windows NT/);
    const data = url.pathname === '/song/url/v1'
      ? [{ id: 101, url: 'https://audio.example/101.mp3' }, { id: 102, url: null }]
      : [{ id: 102, url: 'https://audio.example/102.mp3', freeTrialInfo: { start: 0 }, time: 30000 }];
    return new Response(JSON.stringify({ code: 200, data }));
  };
  const result = await getPlayability(['101', '102']);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].searchParams.get('id'), '102');
  assert.ok(result.get('101')?.url);
  assert.equal(result.get('102').preview, true);
  globalThis.fetch = async url => {
    if (url.pathname === '/song/url/v1') throw new Error('upstream failed');
    return new Response(JSON.stringify({ code: 200, data: [{ id: 103, url: 'https://audio.example/103.mp3' }] }));
  };
  assert.ok((await getPlayability(['103'])).get('103')?.url);
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 200, data: [{ id: 104, url: null }] }));
  assert.equal((await getPlayability(['104'])).get('104'), null);
  globalThis.fetch = async url => {
    if (url.pathname === '/song/url/v1') return new Response(JSON.stringify({ code: 200, data: [{ id: 105, url: 'https://audio.example/105.mp3' }] }));
    throw new Error('legacy unavailable');
  };
  assert.ok((await getPlayability(['105', '106'])).get('105')?.url);
  console.log('通过：播放客户端一致、空音源/异常回退、部分成功保护和版权空结果。');
} finally { globalThis.fetch = originalFetch; }

// 模拟 Serverless 冷启动：/tmp 中没有可用游客会话时，SDK 必须自行初始化。
const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const sdkPath = require.resolve('../music-api/node_modules/NeteaseCloudMusicApi/main.js');
const oldSdk = require.cache[sdkPath];
let registrations = 0;
require.cache[sdkPath] = { exports: {
  cloudsearch: async params => {
    assert.equal(params.cookie, '');
    return { status: 200, body: { code: 200, result: { songs: [], songCount: 0 } } };
  },
  register_anonimous: async () => { registrations++; return { body: { cookie: 'MUSIC_A=test-anonymous;' } }; },
  song_url_v1: async params => {
    assert.equal(params.cookie.MUSIC_A, 'test-anonymous');
    assert.equal(params.timeout, 10000);
    return { status: 200, body: { code: 200, data: params.id.split(',').map(id => ({ id, url: 'https://audio.example/' + id + '.mp3' })) } };
  },
} };
process.env.NETEASE_EMBEDDED = '1';
try {
  const { search } = await import('../server/src/services/neteaseService.js');
  await search('test');
  assert.equal(registrations, 0, '歌曲搜索不能依赖游客注册成功');
  const [a, b] = await Promise.all([getPlayability(['201']), getPlayability(['202'])]);
  assert.ok(a.get('201')?.url && b.get('202')?.url);
  assert.equal(registrations, 1);
  console.log('通过：Serverless 冷启动游客会话、并发初始化去重与上游超时。');
} finally {
  if (oldSdk) require.cache[sdkPath] = oldSdk;
  else delete require.cache[sdkPath];
}
