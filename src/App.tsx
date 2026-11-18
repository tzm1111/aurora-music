import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, MessageCircle } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { MainView } from './components/MainView';
import { Discover } from './components/Discover';
import { ChatPanel } from './components/ChatPanel';
import { MiniBar } from './components/MiniBar';
import { NowPlaying } from './components/NowPlaying';
import { MeshBackground } from './components/MeshBackground';
import { AudioEngine } from './components/AudioEngine';
import { usePlayer, useCurrentTrack } from './store/usePlayer';
import { extractPalette, applyPaletteToCSS } from './lib/colorExtract';

export default function App() {
  const current = useCurrentTrack();
  const setWeather = usePlayer(s => s.setWeather);
  const view = usePlayer(s => s.view);
  const immersive = usePlayer(s => s.immersive);
  const chatOpen = usePlayer(s => s.chatOpen);
  const setChatOpen = usePlayer(s => s.setChatOpen);
  const navOpen = usePlayer(s => s.navOpen);
  const setNavOpen = usePlayer(s => s.setNavOpen);
  const nowPlayingOpen = usePlayer(s => s.nowPlayingOpen);
  const palette = usePlayer(s => s.palette);
  const setPalette = usePlayer(s => s.setPalette);
  const isPlaying = usePlayer(s => s.isPlaying);
  const audioError = usePlayer(s => s.audioError);
  const setAudioError = usePlayer(s => s.setAudioError);

  // 根据当前小时动态推断默认天气/夜晚
  useEffect(() => {
    const h = new Date().getHours();
    if (h >= 22 || h < 6) setWeather('night');
  }, [setWeather]);

  // 封面色调 → 全局变量 + 快照（mesh 背景交叉淡入用）
  useEffect(() => {
    if (!current) return;
    extractPalette(current.cover).then(p => {
      applyPaletteToCSS(p);
      setPalette(p);
    });
  }, [current?.cover, setPalette]);

  // 播放失败提示 5 秒后自动消失
  useEffect(() => {
    if (!audioError) return;
    const t = setTimeout(() => setAudioError(null), 5000);
    return () => clearTimeout(t);
  }, [audioError, setAudioError]);

  // 沉浸模式：仅在 discover 页生效
  const isImmersive = immersive && view === 'discover';

  // 全局键盘快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
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
          if (s.nowPlayingOpen) s.setNowPlayingOpen(false);
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
    <div className={`app app-v2 ${isImmersive ? 'app-immersive' : ''}`}>
      <MeshBackground palette={palette} isPlaying={isPlaying} />

      {!isImmersive && (
        <header className="topbar">
          <button className="topbar-btn" onClick={() => setNavOpen(true)} title="导航">
            <Menu size={20} />
          </button>
          <div className="brand">
            <div className="brand-dot" />
            <span>Aurora</span>
          </div>
          <div className="topbar-right">
            <button className="topbar-btn" onClick={() => setChatOpen(!chatOpen)} title="音乐伙伴">
              <MessageCircle size={19} />
            </button>
          </div>
        </header>
      )}

      <main className="stage">
        {view === 'home' ? <MainView /> : <Discover />}
      </main>

      <AnimatePresence>
        {navOpen && (
          <motion.div
            key="nav-backdrop"
            className="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setNavOpen(false)}
          >
            <motion.aside
              className="nav-drawer"
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              onClick={e => {
                e.stopPropagation();
                if ((e.target as HTMLElement).closest('.nav-item')) setNavOpen(false);
              }}
            >
              <Sidebar />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {chatOpen && !isImmersive && (
          <motion.div
            key="chat-drawer"
            className="chat-drawer"
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          >
            <ChatPanel />
          </motion.div>
        )}
      </AnimatePresence>

      {!isImmersive && (
        <AnimatePresence>
          {nowPlayingOpen ? <NowPlaying key="np" /> : <MiniBar key="mini" />}
        </AnimatePresence>
      )}

      <AudioEngine />
      {audioError && (
        <div className="audio-err" onClick={() => setAudioError(null)} title="点击关闭">
          <span>{audioError}</span>
          <span className="audio-err-hint">点击关闭 · 可试试其他歌曲</span>
        </div>
      )}
    </div>
  );
}
