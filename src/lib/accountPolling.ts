import type { AccountStatus } from '../services/api';

export type QRCheck = AccountStatus & { status: 'waiting' | 'scanned' | 'authorized' | 'expired' | 'unavailable' };

// 短暂断网不作废二维码；同一轮只有一个请求，关闭或刷新后不再更新界面。
export function pollAccountQR(options: {
  expiresAt: number;
  check: (signal: AbortSignal) => Promise<QRCheck>;
  onStatus: (message: string) => void;
  onAuthorized: (account: AccountStatus) => void;
}) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  let stopped = false;
  let checking = false;
  let failures = 0;
  let scanned = false;
  const stop = () => { stopped = true; controller.abort(); clearTimeout(timer); };
  const schedule = (delay: number) => {
    clearTimeout(timer);
    timer = setTimeout(check, Math.min(delay, Math.max(0, options.expiresAt - Date.now())));
  };
  const check = async () => {
    if (stopped || checking) return;
    if (Date.now() >= options.expiresAt) { options.onStatus('二维码已过期，请刷新'); stop(); return; }
    checking = true;
    try {
      const data = await options.check(controller.signal);
      if (stopped) return;
      if (data.status === 'authorized' && data.loggedIn) {
        stop(); options.onStatus('已连接'); options.onAuthorized(data); return;
      }
      if (data.status === 'expired') { options.onStatus('二维码已过期，请刷新'); stop(); return; }
      if (!['waiting', 'scanned'].includes(data.status)) throw new Error('扫码状态暂不可用');
      failures = 0;
      scanned ||= data.status === 'scanned';
      options.onStatus(scanned ? '已扫码，请在网易云 App 确认登录' : '网易云 App 扫码');
    } catch {
      if (stopped) return;
      failures++;
      options.onStatus(scanned ? '已扫码，正在重新连接…' : '网络暂时不稳定，正在重试…');
    } finally { checking = false; }
    if (!stopped) schedule(failures ? Math.min(12000, 2000 + failures * 2000) : 2500);
  };
  schedule(1500);
  return { stop, resume: () => { if (!stopped && !checking) { clearTimeout(timer); void check(); } } };
}
