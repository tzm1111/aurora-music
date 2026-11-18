import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

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
