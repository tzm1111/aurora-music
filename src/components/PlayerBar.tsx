import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, ListMusic, Heart } from 'lucide-react';
import { usePlayer, useCurrentTrack } from '../store/usePlayer';

function fmt(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function PlayerBar() {
  const current = useCurrentTrack();
  const isPlaying = usePlayer(s => s.isPlaying);
  const togglePlay = usePlayer(s => s.togglePlay);
  const next = usePlayer(s => s.next);
  const prev = usePlayer(s => s.prev);
  const progress = usePlayer(s => s.progress);
  const duration = usePlayer(s => s.duration) || (current?.duration ?? 0);
  const volume = usePlayer(s => s.volume);
  const setVolume = usePlayer(s => s.setVolume);
  const seek = usePlayer(s => s.seek);

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    seek(Math.max(0, Math.min(1, x)) * duration);
  };

  const onVol = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    setVolume(x);
  };

  return (
    <footer className="player glass">
      <div className="now-info">
        {current ? (
          <>
            <div className="cover">
              <img src={current.cover} alt={current.title} />
            </div>
            <div className="meta">
              <div className="title">{current.title}</div>
              <div className="artist">{current.artist}</div>
            </div>
            <button title="收藏" style={{color:'rgb(var(--text-mute))', marginLeft: 8}}>
              <Heart size={16}/>
            </button>
          </>
        ) : (
          <div style={{color:'rgb(var(--text-mute))', fontSize: 13}}>还没开始播放…</div>
        )}
      </div>

      <div className="controls-wrap">
        <div className="controls">
          <button title="随机"><Shuffle size={16}/></button>
          <button title="上一首" onClick={prev}><SkipBack size={18} fill="currentColor"/></button>
          <button className="play-main" onClick={togglePlay} title={isPlaying ? '暂停' : '播放'}>
            {isPlaying ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>}
          </button>
          <button title="下一首" onClick={next}><SkipForward size={18} fill="currentColor"/></button>
          <button title="循环"><Repeat size={16}/></button>
        </div>
        <div className="progress-row">
          <span>{fmt(progress)}</span>
          <div className="progress" onClick={onSeek}>
            <div className="fill" style={{ width: `${pct}%` }} />
            <div className="knob" style={{ left: `${pct}%` }} />
          </div>
          <span>{fmt(duration)}</span>
        </div>
      </div>

      <div className="player-right">
        <button title="队列"><ListMusic size={16}/></button>
        <div className="volume">
          <Volume2 size={16}/>
          <div className="bar" onClick={onVol}>
            <div className="fill" style={{ width: `${volume * 100}%` }} />
          </div>
        </div>
      </div>
    </footer>
  );
}
