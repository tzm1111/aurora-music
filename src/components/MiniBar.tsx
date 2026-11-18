import { motion } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, ListMusic, LoaderCircle, Volume2, Music2, Heart } from 'lucide-react';
import { usePlayer, useCurrentTrack } from '../store/usePlayer';

const fmt = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
export function MiniBar() {
  const current = useCurrentTrack();
  const isPlaying = usePlayer(s => s.isPlaying);
  const progress = usePlayer(s => s.progress);
  const duration = usePlayer(s => s.duration) || (current?.duration ?? 0);
  const volume = usePlayer(s => s.volume);
  const favorites = usePlayer(s => s.favoriteIds);
  const status = usePlayer(s => s.playbackStatus);
  const busy = status === 'loading' || status === 'buffering';
  const state = usePlayer.getState();
  const pct = duration > 0 ? Math.min(100, progress / duration * 100) : 0;
  return <motion.footer layoutId="player-shell" className="mini-bar glass" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .2 }} aria-label="音乐播放器">
    {current ? <>
      <button className="mini-track" aria-label={`展开播放器：${current.title}`} onClick={() => state.setNowPlayingOpen(true)}>
        <motion.img layoutId="np-cover" className="mini-cover" src={current.cover} alt="" />
        <div className="mini-meta"><motion.div layoutId="np-title" className="mini-title">{current.title}{current.preview && <span className="vip-badge">试听</span>}</motion.div><div className="mini-artist">{busy ? '正在缓冲…' : status === 'error' ? '播放失败' : current.artist}</div></div>
      </button>
      <div className="mini-center">
        <div className="mini-controls">
          <button className="mini-prev" onClick={state.prev} aria-label="上一首" title="上一首"><SkipBack size={18} fill="currentColor"/></button>
          <button className="mini-play" onClick={state.togglePlay} aria-label={isPlaying ? '暂停' : '播放'} title={isPlaying ? '暂停' : '播放'}>{busy ? <LoaderCircle className="spin" size={18}/> : isPlaying ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>}</button>
          <button onClick={state.next} aria-label="下一首" title="下一首"><SkipForward size={18} fill="currentColor"/></button>
        </div>
        <div className="mini-seek"><span>{fmt(progress)}</span><input type="range" aria-label="播放进度" aria-valuetext={`${fmt(progress)}，总长 ${fmt(duration)}`} min="0" max={duration || 1} step="1" value={Math.min(progress, duration || 1)} disabled={!duration} onChange={e => state.seek(Number(e.target.value))}/><span>{fmt(duration)}</span></div>
      </div>
      <div className="mini-extras"><button className="mini-like" aria-label={`${favorites.includes(current.id) ? '取消喜欢' : '喜欢'} ${current.title}`} title={favorites.includes(current.id) ? '取消喜欢' : '喜欢'} aria-pressed={favorites.includes(current.id)} onClick={() => state.toggleFavorite(current.id)}><Heart size={18} fill={favorites.includes(current.id) ? 'currentColor' : 'none'}/></button><div className="mini-volume"><Volume2 size={16}/><input type="range" aria-label="音量" min="0" max="1" step="0.01" value={volume} onChange={e => state.setVolume(Number(e.target.value))}/></div><button className="mini-queue" aria-label="播放队列" title="播放队列" onClick={() => state.setQueueOpen(true)}><ListMusic size={20}/></button></div>
    </> : <button className="mini-empty" onClick={() => state.setView('home')}><Music2 size={18}/>让 DJ 为你选一首歌</button>}
    <div className="mini-progress" aria-hidden="true"><div className="fill" style={{ width: `${pct}%` }}/></div>
  </motion.footer>;
}
