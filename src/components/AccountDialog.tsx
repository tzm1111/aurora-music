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
      setImage(data.image); setExpires(data.expiresAt); setStatus('用网易云音乐 App 扫码，并在手机上确认。');
    } catch (e) { if (!ctrl.signal.aborted) setStatus(e instanceof Error ? e.message : '登录暂时不可用'); }
    finally { if (!ctrl.signal.aborted) setBusy(false); }
  };
  useEffect(() => {
    if (!image || account.loggedIn) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const ctrl = new AbortController();
    const check = async () => {
      if (Date.now() > expires) { setStatus('二维码已过期，请刷新。'); return; }
      try {
        const data = await apiRequest<AccountStatus & { status: string }>('/api/account/check', {}, ctrl.signal);
        if (stopped) return;
        if (data.status === 'authorized') { onChange(data); setStatus('已连接，按账号权限获取音源。'); return; }
        if (data.status === 'expired') { setStatus('二维码已过期，请刷新。'); return; }
        if (data.status === 'scanned') setStatus('已扫码，请在手机上确认登录。');
        if (data.status === 'unavailable') { setStatus('扫码状态暂不可用，请刷新二维码。'); return; }
      } catch { if (!stopped) { setStatus('连接暂时中断，请刷新二维码后重试。'); return; } }
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
    <button className="connection-close" title="关闭账号面板" onClick={onClose}><X size={20}/></button><p className="dj-eyebrow">音乐账号</p><h2>{account.loggedIn ? '音乐已连接' : '用你的账号，听更多'}</h2>
    {account.loggedIn ? <><p>{account.profile?.nickname || '网易云账号'}已连接。可播放范围以会员、歌曲版权及账号实际权限为准。</p><button className="dj-start" onClick={logout}>退出网易云账号</button></> : <><p>连接网易云后，DJ 会按你的账号权限优先推荐能完整播放的歌曲。</p>
      <div className="account-qr">{image ? <img src={image} alt="网易云登录二维码"/> : busy ? <LoaderCircle className="spin" size={30}/> : <span>扫码确认后即可连接</span>}</div>
      <p role="status" className="connection-note">{status || '无需输入密码，由你在网易云 App 中确认。'}</p>
      <button className="dj-start" disabled={busy} onClick={createQR}><RefreshCw size={16}/>{image ? '刷新二维码' : '生成登录二维码'}</button>
    </>}
    <p className="connection-note">登录信息由后端加密保护，页面不明文保存网易云 Cookie。会话到期后需重新连接。</p>
  </Dialog>;
}
