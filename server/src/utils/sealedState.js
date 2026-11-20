import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export function initializeSessionSecret() {
  if (process.env.AURORA_SESSION_SECRET || process.env.VERCEL) return;
  const file = process.env.AURORA_SESSION_KEY_FILE || path.join(homedir(), '.aurora-music', 'session.key');
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  try {
    writeFileSync(file, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const value = readFileSync(file, 'utf8').trim();
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('服务器会话密钥文件无效');
  process.env.AURORA_SESSION_SECRET = value;
}

export function hasSealedSessions() { return Boolean(process.env.AURORA_SESSION_SECRET); }
function key() {
  const value = process.env.AURORA_SESSION_SECRET || '';
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('服务器会话密钥未配置');
  return Buffer.from(value, 'hex');
}
export function seal(value, purpose) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(purpose));
  const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}
export function unseal(value, purpose) {
  if (typeof value !== 'string' || value.length > 12000) return null;
  try {
    const data = Buffer.from(value, 'base64url');
    if (data.length < 29) return null;
    const decipher = createDecipheriv('aes-256-gcm', key(), data.subarray(0, 12));
    decipher.setAAD(Buffer.from(purpose));
    decipher.setAuthTag(data.subarray(12, 28));
    const result = JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString());
    return result && result.expires > Date.now() ? result : null;
  } catch { return null; }
}
