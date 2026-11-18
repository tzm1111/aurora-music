import { useMemo } from 'react';
import { usePlayer } from '../store/usePlayer';

// 装饰波形进度条；原生滑块支持触摸拖动与键盘调整。
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function WaveformBar({ trackId }: { trackId: string }) {
  const progress = usePlayer(s => s.progress);
  const duration = usePlayer(s => s.duration);
  const seek = usePlayer(s => s.seek);

  const bars = useMemo(() => {
    const rnd = mulberry32(hashStr(trackId));
    return Array.from({ length: 72 }, () => 0.25 + rnd() * 0.75);
  }, [trackId]);

  const pct = duration > 0 ? progress / duration : 0;

  return (
    <div className="waveform">
      <input className="waveform-input" type="range" aria-label="播放进度" aria-valuetext={`${Math.floor(progress / 60)} 分 ${Math.floor(progress % 60)} 秒`} min="0" max={duration || 1} step="1" value={Math.min(progress, duration || 1)} disabled={!duration} onChange={e => seek(Number(e.target.value))}/>
      {bars.map((h, i) => (
        <span
          aria-hidden="true" key={i}
          className={`wf-bar ${i / bars.length <= pct ? 'played' : ''}`}
          style={{ height: `${Math.round(h * 100)}%` }}
        />
      ))}
    </div>
  );
}
