import { createPortal } from 'react-dom';
import { useDialogFocus } from '../lib/useDialogFocus';
import { motion } from 'framer-motion';
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, Heart, ListMusic, LoaderCircle, Repeat1 } from 'lucide-react';
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

  const favorites = usePlayer(s => s.favoriteIds);
  const shuffle = usePlayer(s => s.shuffle);
  const repeat = usePlayer(s => s.repeat);
  const status = usePlayer(s => s.playbackStatus);
  const busy = status === 'loading' || status === 'buffering';
  const dialogRef = useDialogFocus(() => setNowPlayingOpen(false), '.mini-track');
  if (!current) return null;

  return createPortal(
    <motion.div
      layoutId="player-shell"
      ref={dialogRef} role="dialog" aria-modal="true" aria-label="正在播放" tabIndex={-1}
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
        <span className="np-now">{busy ? '正在缓冲…' : status === 'error' ? '播放遇到问题' : isPlaying ? '正在播放' : '暂停 · 随时继续'}</span>
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

        <div className="np-details">
        <motion.div layoutId="np-title" className="np-title">{current.title}{current.preview && <span className="vip-badge">试听</span>}</motion.div>
        <div className="np-artist">{current.artist}{current.album ? ` · ${current.album}` : ''}</div>

        <WaveformBar trackId={current.id} />
        <div className="np-times"><span>{fmt(progress)}</span><span>{fmt(duration)}</span></div>

        <div className="np-controls">
          <button title="随机播放" aria-pressed={shuffle} className={shuffle ? 'control-active' : ''} onClick={() => usePlayer.getState().toggleShuffle()}><Shuffle size={18} /></button>
          <button title="上一首" onClick={prev}><SkipBack size={20} fill="currentColor" /></button>
          <button className="np-play" onClick={togglePlay} title={isPlaying ? '暂停' : '播放'}>
            {busy ? <LoaderCircle className="spin" size={22}/> : isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
          </button>
          <button title="下一首" onClick={next}><SkipForward size={20} fill="currentColor" /></button>
          <button title={repeat === 'one' ? '单曲循环' : repeat === 'all' ? '列表循环' : '循环已关闭'} className={repeat !== 'off' ? 'control-active' : ''} onClick={() => usePlayer.getState().cycleRepeat()}>{repeat === 'one' ? <Repeat1 size={18}/> : <Repeat size={18}/>}</button>
        </div>

        <div className="np-bottom">
          <button className="np-icon-btn" title={favorites.includes(current.id) ? '取消收藏' : '收藏'} aria-pressed={favorites.includes(current.id)} onClick={() => usePlayer.getState().toggleFavorite(current.id)}><Heart size={17} fill={favorites.includes(current.id) ? 'currentColor' : 'none'}/></button>
          <button className="np-icon-btn" title="播放队列" onClick={() => usePlayer.getState().setQueueOpen(true)}><ListMusic size={18}/></button>
          <div className="np-volume">
            <Volume2 size={16} />
            <input type="range" min="0" max="1" step="0.01" value={volume} aria-label="音量" onChange={e => setVolume(Number(e.target.value))}/>
          </div>
        </div>
        </div>
      </div>
    </motion.div>, document.body
  );
}
