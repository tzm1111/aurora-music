import { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { MainView } from './components/MainView';
import { Discover } from './components/Discover';
import { ChatPanel } from './components/ChatPanel';
import { PlayerBar } from './components/PlayerBar';
import { AudioEngine } from './components/AudioEngine';
import { usePlayer, useCurrentTrack } from './store/usePlayer';
import { extractPalette, applyPaletteToCSS } from './lib/colorExtract';

export default function App() {
  const current = useCurrentTrack();
  const setWeather = usePlayer(s => s.setWeather);
  const view = usePlayer(s => s.view);
  const immersive = usePlayer(s => s.immersive);
  const audioError = usePlayer(s => s.audioError);
  const setAudioError = usePlayer(s => s.setAudioError);

  // 根据当前小时动态推断默认天气/夜晚
  useEffect(() => {
    const h = new Date().getHours();
    if (h >= 22 || h < 6) setWeather('night');
  }, [setWeather]);

  // 封面色调 → 全局变量
  useEffect(() => {
    if (!current) return;
    extractPalette(current.cover).then(applyPaletteToCSS);
  }, [current?.cover]);

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
          if (s.immersive) s.setImmersive(false);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={`app ${isImmersive ? 'app-immersive' : ''}`}>
      <div className="aurora-bg" />
      <div className={`layout ${isImmersive ? 'layout-immersive' : ''}`}>
        {!isImmersive && <Sidebar />}
        {view === 'home' ? <MainView /> : <Discover />}
        {!isImmersive && <ChatPanel />}
        {!isImmersive && <PlayerBar />}
      </div>
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
