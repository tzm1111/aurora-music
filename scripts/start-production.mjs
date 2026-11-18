import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
  const timer = setTimeout(() => { for (const child of children) child.kill('SIGKILL'); }, 5000);
  timer.unref();
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
function start(file, env) {
  const child = spawn(process.execPath, [file], { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
  children.push(child);
  child.once('error', () => stop(1));
  child.once('exit', code => { if (!stopping) stop(code || 1); });
}
function listening(port) {
  return new Promise(resolve => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.setTimeout(500);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => { socket.destroy(); resolve(false); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
  });
}
const musicPort = Number(process.env.INTERNAL_MUSIC_PORT || 3100);
if (!Number.isInteger(musicPort) || musicPort < 1 || musicPort > 65535) throw new Error('Invalid INTERNAL_MUSIC_PORT');
if (await listening(musicPort)) throw new Error('Music API port is already in use');
start(root + 'music-api/node_modules/NeteaseCloudMusicApi/app.js', { HOST: '127.0.0.1', PORT: String(musicPort) });
for (let attempt = 0; attempt < 120 && !stopping; attempt++) {
  if (await listening(musicPort)) {
    start(root + 'server/src/index.js', { HOST: process.env.HOST || '0.0.0.0', SERVE_STATIC: '1', NETEASE_MUSIC_API_URL: `http://127.0.0.1:${musicPort}` });
    break;
  }
  if (attempt === 119) { console.error('Music API startup timed out'); stop(1); }
  await new Promise(resolve => setTimeout(resolve, 500));
}
