import { motion } from 'framer-motion';
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, Heart } from 'lucide-react';
import { usePlayer, useCurrentTrack } from '../store/usePlayer';
import { SpectrumRing } from './SpectrumRing';
import { WaveformBar } from './WaveformBar';

const SPRING = { type: 'spring' as const, stiffness: 260, damping: 30 };

function fmt(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// 全屏 Now Playing：与迷你条共享 layoutId，封面/标题/容器一起形变展开。
export function NowPlaying() {
  const current = useCurrentTrack();
  const isPlaying = usePlayer(s => s.isPlaying);
  const togglePlay = usePlayer(s => s.togglePlay);
  const next = usePlayer(s => s.next);
  const prev = usePlayer(s => s.prev);
  const progress = usePlayer(s => s.progress);
  const duration = usePlayer(s => s.duration) || (current?.duration ?? 0);
  const volume = usePlayer(s => s.volume);
  const setVolume = usePlayer(s => s.setVolume);
  const setNowPlayingOpen = usePlayer(s => s.setNowPlayingOpen);

  if (!current) return null;

  const onVol = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    setVolume(x);
  };

  return (
    <motion.div
      layoutId="player-shell"
      className="now-playing"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={SPRING}
    >
      <div className="np-top">
        <button className="np-collapse" onClick={() => setNowPlayingOpen(false)} title="收起">
          <ChevronDown size={22} />
        </button>
        <span className="np-now">正在播放</span>
      </div>

      <div className="np-stage">
        <div className="np-cover-wrap">
          <SpectrumRing />
          <motion.img
            layoutId="np-cover"
            src={current.cover}
            alt={current.title}
            className="np-cover"
            animate={{ scale: isPlaying ? 1 : 0.96 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          />
        </div>

        <motion.div layoutId="np-title" className="np-title">{current.title}</motion.div>
        <div className="np-artist">{current.artist}{current.album ? ` · ${current.album}` : ''}</div>

        <WaveformBar trackId={current.id} />
        <div className="np-times"><span>{fmt(progress)}</span><span>{fmt(duration)}</span></div>

        <div className="np-controls">
          <button title="随机"><Shuffle size={18} /></button>
          <button title="上一首" onClick={prev}><SkipBack size={20} fill="currentColor" /></button>
          <button className="np-play" onClick={togglePlay} title={isPlaying ? '暂停' : '播放'}>
            {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
          </button>
          <button title="下一首" onClick={next}><SkipForward size={20} fill="currentColor" /></button>
          <button title="循环"><Repeat size={18} /></button>
        </div>

        <div className="np-bottom">
          <button className="np-icon-btn" title="收藏"><Heart size={17} /></button>
          <div className="np-volume">
            <Volume2 size={16} />
            <div className="bar" onClick={onVol}>
              <div className="fill" style={{ width: `${volume * 100}%` }} />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
