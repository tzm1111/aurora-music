import type { AccountStatus } from '../services/api';

export type QRCheck = AccountStatus & { status: 'waiting' | 'scanned' | 'authorized' | 'expired' | 'unavailable' | 'session_lost' };

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
  let lastError = '';
  const stop = () => { stopped = true; controller.abort(); clearTimeout(timer); };
  const schedule = (delay: number) => {
    clearTimeout(timer);
    timer = setTimeout(check, Math.min(delay, Math.max(0, options.expiresAt - Date.now())));
  };
  const check = async () => {
    if (stopped || checking) return;
    // 截止时最后确认一次，不能把反复网络错误当作网易云明确返回的过期。
    const finalCheck = Date.now() >= options.expiresAt;
    checking = true;
    try {
      const data = await options.check(controller.signal);
      if (stopped) return;
      if (data.status === 'authorized' && data.loggedIn) {
        stop(); options.onStatus('已连接'); options.onAuthorized(data); return;
      }
      if (data.status === 'expired') { options.onStatus('二维码已过期，请刷新'); stop(); return; }
      if (data.status === 'session_lost') { options.onStatus('登录会话丢失，请重新生成二维码'); stop(); return; }
      if (!['waiting', 'scanned'].includes(data.status)) throw new Error('扫码状态暂不可用');
      failures = 0;
      scanned ||= data.status === 'scanned';
      if (finalCheck) { options.onStatus(scanned ? '未收到 App 登录确认，请重新生成二维码' : '二维码已过期，请刷新'); stop(); return; }
      options.onStatus(scanned ? '已扫码，请在网易云 App 确认登录' : '网易云 App 扫码');
    } catch (error) {
      if (stopped) return;
      failures++;
      lastError = error instanceof Error ? error.message.match(/NETEASE_(?:HTTP_\d{3}|CODE_\d{3}|TIMEOUT|NETWORK)/)?.[0] || '' : '';
      if (finalCheck) { options.onStatus(`登录结果无法确认${lastError ? `（${lastError}）` : '，网络持续异常'}，请重试`); stop(); return; }
      options.onStatus(scanned ? '已扫码，正在重新连接…' : '网络暂时不稳定，正在重试…');
    } finally { checking = false; }
    if (!stopped) schedule(failures ? Math.min(12000, 2000 + failures * 2000) : 2500);
  };
  schedule(1500);
  return { stop, resume: () => { if (!stopped && !checking) { clearTimeout(timer); void check(); } } };
}
