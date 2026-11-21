import { Dialog } from './Dialog';
import { useEffect, useRef, useState } from 'react';
import { X, RefreshCw, LoaderCircle } from 'lucide-react';
import { apiRequest } from '../services/api';
import type { AccountStatus } from '../services/api';
import { pollAccountQR } from '../lib/accountPolling';
import type { QRCheck } from '../lib/accountPolling';
export function AccountDialog({ account, onChange, onClose }: { account: AccountStatus; onChange: (a: AccountStatus) => void; onClose: () => void }) {
  const [image, setImage] = useState('');
  const [expires, setExpires] = useState(0);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const polling = useRef<ReturnType<typeof pollAccountQR> | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const createQR = async () => {
    polling.current?.stop();
    controller.current?.abort(); const ctrl = new AbortController(); controller.current = ctrl;
    setBusy(true); setStatus('正在准备二维码…'); setImage('');
    try {
      const data = await apiRequest<{ image: string; expiresAt: number }>('/api/account/qr', {}, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setImage(data.image); setExpires(data.expiresAt); setStatus('网易云 App 扫码');
    } catch (e) { if (!ctrl.signal.aborted) setStatus(e instanceof Error ? e.message : '登录暂时不可用'); }
    finally { if (!ctrl.signal.aborted) setBusy(false); }
  };
  useEffect(() => {
    if (!image || account.loggedIn) return;
    const loop = pollAccountQR({ expiresAt: expires,
      check: signal => apiRequest<QRCheck>('/api/account/check', {}, signal),
      onStatus: setStatus, onAuthorized: onChange });
    polling.current = loop;
    // 扫码时常切换到网易云 App；回到网页后立即查询，不依赖后台计时器。
    const resume = () => { if (document.visibilityState === 'visible') loop.resume(); };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    return () => { loop.stop(); document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume); };
  }, [image, expires, account.loggedIn, onChange]);
  const logout = async () => {
    try { await apiRequest('/api/account/logout', {}); onChange({ loggedIn: false, profile: null }); setImage(''); }
    catch { setStatus('暂时无法退出，请重试。'); }
  };
  return <Dialog label="连接网易云账号" onClose={onClose}>
    <button className="connection-close" title="关闭账号面板" onClick={onClose}><X size={20}/></button><h2>{account.loggedIn ? '已连接' : '网易云账号'}</h2>
    {account.loggedIn ? <><p>{account.profile?.nickname || '网易云账号'}</p><button className="dj-start" onClick={logout}>退出网易云账号</button></> : <>
      <div className="account-qr">{image ? <img src={image} alt="网易云登录二维码"/> : busy ? <LoaderCircle className="spin" size={30}/> : <span>网易云音乐</span>}</div>
      <p role="status" className="connection-note">{status}</p>
      <button className="dj-start" disabled={busy} onClick={createQR}><RefreshCw size={16}/>{image ? '刷新二维码' : '生成登录二维码'}</button>
    </>}
  </Dialog>;
}
