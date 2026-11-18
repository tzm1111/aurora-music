import { motion } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { usePlayer, useCurrentTrack } from '../store/usePlayer';

const SPRING = { type: 'spring' as const, stiffness: 260, damping: 30 };

// 悬浮液态玻璃迷你条：点空白处以共享元素动画展开成全屏 Now Playing。
export function MiniBar() {
  const current = useCurrentTrack();
  const isPlaying = usePlayer(s => s.isPlaying);
  const togglePlay = usePlayer(s => s.togglePlay);
  const next = usePlayer(s => s.next);
  const prev = usePlayer(s => s.prev);
  const progress = usePlayer(s => s.progress);
  const duration = usePlayer(s => s.duration) || (current?.duration ?? 0);
  const setNowPlayingOpen = usePlayer(s => s.setNowPlayingOpen);
  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <motion.footer
      layoutId="player-shell"
      className="mini-bar glass"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={SPRING}
      onClick={() => current && setNowPlayingOpen(true)}
    >
      {current ? (
        <>
          <motion.img layoutId="np-cover" className="mini-cover" src={current.cover} alt="" />
          <div className="mini-meta">
            <motion.div layoutId="np-title" className="mini-title">{current.title}</motion.div>
            <div className="mini-artist">{current.artist}</div>
          </div>
          <div className="mini-controls" onClick={e => e.stopPropagation()}>
            <button onClick={prev} title="上一首"><SkipBack size={16} fill="currentColor" /></button>
            <button className="mini-play" onClick={togglePlay} title={isPlaying ? '暂停' : '播放'}>
              {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
            </button>
            <button onClick={next} title="下一首"><SkipForward size={16} fill="currentColor" /></button>
          </div>
        </>
      ) : (
        <div className="mini-empty">挑一首歌开始</div>
      )}
      <div className="mini-progress"><div className="fill" style={{ width: `${pct}%` }} /></div>
    </motion.footer>
  );
}
