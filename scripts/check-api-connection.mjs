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
globalThis.sessionStorage = { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) };
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
  register_anonimous: async () => { registrations++; return { body: { cookie: 'MUSIC_A=test-anonymous;' } }; },
  song_url_v1: async params => {
    assert.equal(params.cookie.MUSIC_A, 'test-anonymous');
    assert.equal(params.timeout, 10000);
    return { status: 200, body: { code: 200, data: params.id.split(',').map(id => ({ id, url: 'https://audio.example/' + id + '.mp3' })) } };
  },
} };
process.env.NETEASE_EMBEDDED = '1';
try {
  const [a, b] = await Promise.all([getPlayability(['201']), getPlayability(['202'])]);
  assert.ok(a.get('201')?.url && b.get('202')?.url);
  assert.equal(registrations, 1);
  console.log('通过：Serverless 冷启动游客会话、并发初始化去重与上游超时。');
} finally {
  if (oldSdk) require.cache[sdkPath] = oldSdk;
  else delete require.cache[sdkPath];
}
