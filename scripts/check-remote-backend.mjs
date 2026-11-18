import assert from 'node:assert/strict';

const base = process.env.AURORA_API_URL;
assert.ok(base, '请设置 AURORA_API_URL');
const origin = 'https://tzm1111.github.io';
async function request(path, options = {}) {
  return fetch(new URL(path, base), {
    ...options,
    headers: { Origin: origin, ...options.headers },
    signal: AbortSignal.timeout(55000),
  });
}
const health = await request('/api/health');
assert.equal(health.status, 200, '后端健康检查失败');
assert.equal(health.headers.get('access-control-allow-origin'), origin);
assert.equal((await health.json()).status, 'ok');
console.log('通过：公开 API 与 GitHub Pages 跨域访问。');
const search = await request('/api/music/search?source=netease&q=Laufey&limit=5');
assert.equal(search.status, 200, '网易云搜索失败');
const songs = await search.json();
assert.ok(songs.success && songs.tracks.length > 0, '网易云未返回歌曲');
let playable;
for (const song of songs.tracks) {
  const response = await request('/api/music/playback/netease/' + song.sourceId);
  if (response.ok) { playable = await response.json(); break; }
}
assert.ok(playable?.src, '未获得可播放歌曲');
const audio = await request(playable.src, { headers: { Range: 'bytes=0-1023' } });
assert.ok(audio.ok, '音频代理失败');
const reader = audio.body.getReader();
assert.ok((await reader.read()).value?.length, '音频为空');
await reader.cancel();
console.log('通过：真实歌曲搜索、播放票据和音频数据。');
const foreign = await request('/api/music/playback/netease/1', { headers: { Origin: 'https://example.com' } });
assert.equal(foreign.status, 403);
const qr = await request('/api/account/qr', { method: 'POST' });
assert.equal(qr.status, 200, '登录二维码生成失败');
const session = qr.headers.get('x-aurora-session');
assert.ok(session, '未返回加密会话');
assert.ok((await qr.json()).image?.startsWith('data:image/'));
const check = await request('/api/account/check', { method: 'POST', headers: { 'X-Aurora-Session': session } });
assert.equal(check.status, 200);
assert.equal((await check.json()).status, 'waiting');
console.log('通过：来源限制、登录二维码和跨实例扫码会话。');
