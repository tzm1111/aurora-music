import assert from 'node:assert/strict';

const base = process.env.AURORA_API_URL;
assert.ok(base, '请设置 AURORA_API_URL');
const origin = 'https://tzm1111.github.io';
console.log('验证后端:', new URL(base).origin);
async function request(path, options = {}) {
  return fetch(new URL(path, base), {
    ...options,
    headers: { Origin: origin, ...options.headers },
    signal: AbortSignal.timeout(55000),
  });
}
let health;
let healthData;
const deadline = Date.now() + 180000;
do {
  health = await request('/api/health');
  assert.equal(health.status, 200, '后端健康检查失败');
  assert.equal(health.headers.get('access-control-allow-origin'), origin);
  healthData = await health.json();
  if (!process.env.GITHUB_SHA || healthData.deploymentCommit === process.env.GITHUB_SHA) break;
  assert.ok(Date.now() < deadline, 'Vercel 未在 3 分钟内发布当前提交');
  console.log('等待 Vercel 发布当前提交，避免检验上一版后端。');
  await new Promise(resolve => setTimeout(resolve, 5000));
} while (true);
assert.equal(healthData.status, 'ok');
console.log('通过：公开 API 与 GitHub Pages 跨域访问。');
const search = await request('/api/music/search?source=netease&q=Laufey&limit=5');
assert.equal(search.status, 200, '网易云搜索失败');
const songs = await search.json();
assert.ok(songs.success && songs.tracks.length > 0, '网易云未返回歌曲');
let playable;
for (const song of songs.tracks) {
  const response = await request('/api/music/playback/netease/' + song.sourceId);
  if (response.ok) { playable = await response.json(); break; }
  const failure = await response.json().catch(() => ({}));
  console.log('音源检查失败:', song.sourceId, 'HTTP', response.status, failure.error?.code || 'UNKNOWN');
}
assert.ok(playable?.src, '未获得可播放歌曲');
const audio = await request(playable.src, { headers: { Range: 'bytes=0-1023' } });
assert.equal(audio.status, 206, '音频代理没有返回 Range 分段响应');
assert.match(audio.headers.get('content-range') || '', /^bytes 0-1023\//);
assert.equal(audio.headers.get('access-control-allow-origin'), origin);
const reader = audio.body.getReader();
assert.ok((await reader.read()).value?.length, '音频为空');
await reader.cancel();
console.log('通过：真实歌曲搜索、播放票据和音频数据。');
const foreign = await request('/api/music/playback/netease/1', { headers: { Origin: 'https://example.com' } });
assert.equal(foreign.status, 403);
const preflight = await request('/api/dj/session', { method: 'OPTIONS', headers: {
  'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-aurora-session',
} });
assert.equal(preflight.status, 204);
assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
const dj = await request('/api/dj/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: '放松的纯音乐' }) });
const set = await dj.json();
assert.equal(dj.status, 200, 'DJ 推荐失败：' + (set.error?.message || dj.status));
assert.ok(set.success && set.tracks?.length > 0, 'DJ 未返回歌曲');
console.log('通过：Pages 预检与 DJ 推荐，曲目数', set.tracks.length);
// 登录校验仅显式开启时执行，普通部署验证不创建登录会话。
if (process.env.AURORA_TEST_LOGIN === '1') {
const qr = await request('/api/account/qr', { method: 'POST' });
assert.equal(qr.status, 200, '登录二维码生成失败');
const session = qr.headers.get('x-aurora-session');
assert.ok(session, '未返回加密会话');
assert.ok((await qr.json()).image?.startsWith('data:image/'));
const check = await request('/api/account/check', { method: 'POST', headers: { 'X-Aurora-Session': session } });
assert.equal(check.status, 200);
assert.equal((await check.json()).status, 'waiting');
console.log('通过：来源限制、登录二维码和跨实例扫码会话。');
}
