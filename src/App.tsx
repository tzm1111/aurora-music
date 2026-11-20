import { useEffect, useCallback, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Dialog } from './components/Dialog';
import { useAutoDJ } from './lib/useAutoDJ';
import { Menu, UserRound, Sparkles, Music2, Radio, CircleAlert, X } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { MainView } from './components/MainView';
import { Discover } from './components/Discover';
import { AccountDialog } from './components/AccountDialog';
import { DJHome } from './components/DJHome';
import { DJPlaylistView } from './components/DJPlaylistView';
import { WeatherWidget } from './components/WeatherWidget';
import { apiRequest } from './services/api';
import type { AccountStatus } from './services/api';
import { MiniBar } from './components/MiniBar';
import { NowPlaying } from './components/NowPlaying';
import { MeshBackground } from './components/MeshBackground';
import { AudioEngine } from './components/AudioEngine';
import { CollectionView } from './components/CollectionView';
import { QueuePanel } from './components/QueuePanel';
import { usePlayer, useCurrentTrack, hydrateLocalAudio } from './store/usePlayer';
import { extractPalette, applyPaletteToCSS } from './lib/colorExtract';

export default function App() {
  const current = useCurrentTrack();
  const currentCover = current?.cover;
  useAutoDJ();
  const view = usePlayer(s => s.view);
  const immersive = usePlayer(s => s.immersive);
  const [accountOpen, setAccountOpen] = useState(false);
  const [account, setAccount] = useState<AccountStatus>({ loggedIn: false, profile: null });
  const accountRequest = useRef<AbortController | null>(null);
  const updateAccount = useCallback((value: AccountStatus) => { accountRequest.current?.abort(); setAccount(value); window.dispatchEvent(new Event('aurora-connections')); }, []);
  useEffect(() => {
    const controller = new AbortController();
    accountRequest.current = controller;
    apiRequest<AccountStatus>('/api/account/status', undefined, controller.signal).then(value => { if (!controller.signal.aborted) setAccount(value); }).catch(() => {});
    return () => controller.abort();
  }, []);
  const navOpen = usePlayer(s => s.navOpen);
  const setNavOpen = usePlayer(s => s.setNavOpen);
  const nowPlayingOpen = usePlayer(s => s.nowPlayingOpen);
  const palette = usePlayer(s => s.palette);
  const setPalette = usePlayer(s => s.setPalette);
  const isPlaying = usePlayer(s => s.isPlaying);
  const audioError = usePlayer(s => s.audioError);
  const setAudioError = usePlayer(s => s.setAudioError);

  const queueOpen = usePlayer(s => s.queueOpen);
  const storageError = usePlayer(s => s.storageError);
  useEffect(() => { void hydrateLocalAudio(); }, []);

  // 封面色调 → 全局变量 + 快照（mesh 背景交叉淡入用）
  useEffect(() => {
    if (!currentCover) return;
    let cancelled = false;
    extractPalette(currentCover).then(p => {
      if (cancelled) return;
      applyPaletteToCSS(p);
      setPalette(p);
    });
    return () => { cancelled = true; };
  }, [currentCover, setPalette]);

  // 沉浸模式：仅在 discover 页生效
  const isImmersive = immersive && view === 'discover';

  // 全局键盘快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement | null)?.closest('button, a, select, [role=slider], [contenteditable=true]')) return;
      const s = usePlayer.getState();
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          s.togglePlay();
          break;
        case 'KeyF':
          if (s.view === 'discover') s.setImmersive(!s.immersive);
          else { s.setView('discover'); s.setImmersive(true); }
          break;
        case 'KeyD':
          s.setView(s.view === 'discover' ? 'home' : 'discover');
          break;
        case 'ArrowRight':
          e.preventDefault();
          s.next();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          s.prev();
          break;
        case 'ArrowUp':
          e.preventDefault();
          s.setVolume(s.volume + 0.05);
          break;
        case 'ArrowDown':
          e.preventDefault();
          s.setVolume(s.volume - 0.05);
          break;
        case 'Escape':
          if (s.queueOpen) s.setQueueOpen(false);
          else if (s.nowPlayingOpen) s.setNowPlayingOpen(false);
          else if (s.navOpen) s.setNavOpen(false);
          else if (s.chatOpen) s.setChatOpen(false);
          else if (s.immersive) s.setImmersive(false);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={`app app-v2 ${isImmersive ? 'app-immersive' : ''} ${view === 'home' ? 'app-dj' : ''}`}>
      <MeshBackground palette={palette} isPlaying={isPlaying} />

      {!isImmersive && (
        <header className="topbar">
          <button className="topbar-btn nav-toggle" onClick={() => setNavOpen(true)} title="导航" aria-label="打开音乐库">
            <Menu size={20} />
          </button>
          <div className="brand">
            <div className="brand-dot" />
            <span>Aurora</span>
          </div>
          <div className="topbar-right">
            <nav className="topbar-shortcuts" aria-label="音乐快捷导航">
              {[
                { id: 'home' as const, label: '专属 DJ', Icon: Sparkles },
                { id: 'search' as const, label: '手动找歌', Icon: Music2 },
                { id: 'discover' as const, label: '发现 · 频谱', Icon: Radio },
              ].map(({ id, label, Icon }) => <button key={id} className={`topbar-btn ${view === id ? 'active' : ''}`} title={label} aria-label={label} aria-current={view === id ? 'page' : undefined} onClick={() => usePlayer.getState().setView(id)}><Icon size={18}/></button>)}
            </nav>
            <button className="account-button" onClick={() => setAccountOpen(true)} title="网易云账号" aria-label={account.loggedIn ? `网易云账号：${account.profile?.nickname || '已连接'}` : '连接网易云账号'}><UserRound size={18}/>{account.loggedIn && <i className="account-connected"/>}</button>
          </div>
        </header>
      )}

      {!isImmersive && <div className="weather-region"><WeatherWidget /></div>}

      <div className="workspace-shell">
      <main className="stage" key={view} tabIndex={-1}>
        {view === 'home' ? <DJHome /> : view === 'search' ? <MainView /> : view === 'discover' ? <Discover /> : view === 'djplaylists' ? <DJPlaylistView/> : <CollectionView />}
      </main>
      </div>

      {navOpen && <Dialog label="音乐库导航" onClose={() => setNavOpen(false)} backdropClass="drawer-backdrop" panelClass="nav-drawer">
        <div className="drawer-heading"><span>音乐库</span><button aria-label="关闭音乐库" onClick={() => setNavOpen(false)}>✕</button></div>
        <div className="drawer-content" onClick={e => { if ((e.target as HTMLElement).closest('.nav-item, .playlist-item')) setNavOpen(false); }}><Sidebar /></div>
      </Dialog>}

      {!isImmersive && (
        <AnimatePresence>
          {nowPlayingOpen ? <NowPlaying key="np" /> : <MiniBar key="mini" />}
        </AnimatePresence>
      )}

      <AudioEngine />
      {accountOpen && <AccountDialog account={account} onChange={updateAccount} onClose={() => setAccountOpen(false)}/>}
      {queueOpen && <QueuePanel />}
      {storageError && <div className="storage-warning compact-feedback"><details><summary aria-label="查看存储错误详情"><CircleAlert size={16}/></summary><p>{storageError}</p></details><button aria-label="关闭存储提示" onClick={() => usePlayer.setState({ storageError: null })}><X size={16}/></button></div>}
      {audioError && <div className="audio-err compact-feedback"><details><summary aria-label="查看播放错误详情"><CircleAlert size={16}/></summary><p>{audioError}</p></details>
        <div className="error-actions"><button onClick={() => usePlayer.getState().retry()}>重试</button><button onClick={() => usePlayer.getState().next()}>换一首</button><button aria-label="关闭播放提示" onClick={() => setAudioError(null)}><X size={16}/></button></div>
      </div>}
    </div>
  );
}
