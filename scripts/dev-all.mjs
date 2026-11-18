import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try { if (process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM'); else child.kill(); } catch { /* 进程已结束 */ }
  }
  process.exitCode = code;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
const listening = port => new Promise(resolve => {
  const socket = net.connect({ port, host: '127.0.0.1' });
  socket.setTimeout(500);
  socket.once('connect', () => { socket.destroy(); resolve(true); });
  socket.once('error', () => { socket.destroy(); resolve(false); });
  socket.once('timeout', () => { socket.destroy(); resolve(false); });
});
for (const port of [3100, 3001, 5173]) {
  if (await listening(port)) { console.error(`端口 ${port} 已被使用。请先结束已有 Aurora 服务，再运行 npm run dev:all。`); process.exit(1); }
}
function start(args, cwd) {
  const child = spawn(npm, args, { cwd, stdio: 'inherit', detached: process.platform !== 'win32', env: process.env });
  children.push(child);
  child.once('error', error => { console.error(error.message); stop(1); });
  child.once('exit', code => { if (!stopping) stop(code || 1); });
}
start(['run', 'music-api'], root);
start(['run', 'dev'], root + '/server');
for (let attempt = 0; attempt < 40 && !stopping; attempt++) {
  if (await listening(3100) && await listening(3001)) break;
  if (attempt === 39) { console.error('音乐服务启动超时，请查看上方日志。'); stop(1); }
  await new Promise(resolve => setTimeout(resolve, 250));
}
if (!stopping) {
  start(['run', 'dev', '--', '--host', '127.0.0.1', '--strictPort'], root);
  console.log('Aurora 正在启动：http://127.0.0.1:5173 · 按 Ctrl+C 结束全部服务');
}
