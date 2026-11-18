import { useMemo } from 'react';
import { usePlayer } from '../store/usePlayer';

// 波形进度条：每首歌用 id 做种子生成固定波形，播过的位置点亮，点击可 seek。
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

  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    seek(Math.max(0, Math.min(1, x)) * duration);
  };

  return (
    <div className="waveform" onClick={onSeek}>
      {bars.map((h, i) => (
        <span
          key={i}
          className={`wf-bar ${i / bars.length <= pct ? 'played' : ''}`}
          style={{ height: `${Math.round(h * 100)}%` }}
        />
      ))}
    </div>
  );
}
