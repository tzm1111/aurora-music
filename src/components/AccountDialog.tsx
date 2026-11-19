import { Dialog } from './Dialog';
import { useEffect, useRef, useState } from 'react';
import { X, RefreshCw, LoaderCircle } from 'lucide-react';
import { apiRequest } from '../services/api';
import type { AccountStatus } from '../services/api';
export function AccountDialog({ account, onChange, onClose }: { account: AccountStatus; onChange: (a: AccountStatus) => void; onClose: () => void }) {
  const [image, setImage] = useState('');
  const [expires, setExpires] = useState(0);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const createQR = async () => {
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
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const ctrl = new AbortController();
    const check = async () => {
      if (Date.now() > expires) { setStatus('二维码已过期'); return; }
      try {
        const data = await apiRequest<AccountStatus & { status: string }>('/api/account/check', {}, ctrl.signal);
        if (stopped) return;
        if (data.status === 'authorized') { onChange(data); setStatus('已连接'); return; }
        if (data.status === 'expired') { setStatus('二维码已过期'); return; }
        if (data.status === 'scanned') setStatus('已扫码，等待确认');
        if (data.status === 'unavailable') { setStatus('扫码状态不可用'); return; }
      } catch { if (!stopped) { setStatus('连接中断'); return; } }
      if (!stopped) timer = setTimeout(check, 3000);
    };
    timer = setTimeout(check, 3000);
    return () => { stopped = true; ctrl.abort(); clearTimeout(timer); };
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
