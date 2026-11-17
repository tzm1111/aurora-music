import { useEffect, useMemo, useRef } from 'react';
import { Play, Pause, Maximize2, Minimize2 } from 'lucide-react';
import { usePlayer, useCurrentTrack } from '../store/usePlayer';
import { getAnalyser } from '../lib/audioVisualizer';

type Particle = {
  x: number; y: number;
  vx: number; vy: number;
  life: number;     // 0..1
  size: number;
  hue: 0 | 1;       // 0 = accent, 1 = accent2
};

export function Discover() {
  const ringCanvasRef = useRef<HTMLCanvasElement>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);
  const lyricsRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const current = useCurrentTrack();
  const isPlaying = usePlayer(s => s.isPlaying);
  const togglePlay = usePlayer(s => s.togglePlay);
  const immersive = usePlayer(s => s.immersive);
  const setImmersive = usePlayer(s => s.setImmersive);
  const progress = usePlayer(s => s.progress);
  const customLyrics = usePlayer(s => s.customLyrics);

  const lyrics = (current && customLyrics[current.id]) || current?.lyrics || [];

  // 计算当前应高亮的歌词索引
  const activeIdx = useMemo(() => {
    if (!lyrics.length) return -1;
    let i = 0;
    for (let k = 0; k < lyrics.length; k++) {
      if (progress >= lyrics[k].time) i = k;
      else break;
    }
    return i;
  }, [progress, lyrics]);

  // 自动滚动歌词
  useEffect(() => {
    const wrap = lyricsRef.current;
    if (!wrap) return;
    const target = wrap.querySelector<HTMLDivElement>(`[data-idx="${activeIdx}"]`);
    if (!target) return;
    const offset = target.offsetTop - wrap.clientHeight / 2 + target.clientHeight / 2;
    wrap.scrollTo({ top: offset, behavior: 'smooth' });
  }, [activeIdx]);

  // 主可视化循环
  useEffect(() => {
    const ring = ringCanvasRef.current;
    const wave = waveCanvasRef.current;
    const part = particleCanvasRef.current;
    if (!ring || !wave || !part) return;
    const ringCtx = ring.getContext('2d')!;
    const waveCtx = wave.getContext('2d')!;
    const partCtx = part.getContext('2d')!;

    const setupCanvas = (cv: HTMLCanvasElement) => {
      const dpr = window.devicePixelRatio || 1;
      const rect = cv.getBoundingClientRect();
      cv.width = rect.width * dpr;
      cv.height = rect.height * dpr;
      cv.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0);
      return rect;
    };
    let ringRect = setupCanvas(ring);
    let waveRect = setupCanvas(wave);
    let partRect = setupCanvas(part);

    const onResize = () => {
      ringRect = setupCanvas(ring);
      waveRect = setupCanvas(wave);
      partRect = setupCanvas(part);
    };
    window.addEventListener('resize', onResize);

    const particles: Particle[] = [];
    let lastBass = 0;
    let phase = 0;

    const spawnBurst = (intensity: number, accent: number[], accent2: number[]) => {
      const cx = partRect.width / 2, cy = partRect.height / 2;
      const count = Math.min(120, Math.floor(intensity * 90));
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 5 + intensity * 5;
        particles.push({
          x: cx, y: cy,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          life: 1,
          size: 1.8 + Math.random() * 3,
          hue: Math.random() < 0.5 ? 0 : 1,
        });
      }
      // 防止粒子爆炸
      if (particles.length > 800) particles.splice(0, particles.length - 800);
      void accent; void accent2;
    };

    const updateAndDrawParticles = (accent: number[], accent2: number[]) => {
      // 半透明擦除：让旧帧逐渐淡出形成拖尾
      partCtx.globalCompositeOperation = 'destination-out';
      partCtx.fillStyle = 'rgba(0,0,0,0.18)';
      partCtx.fillRect(0, 0, partRect.width, partRect.height);
      partCtx.globalCompositeOperation = 'lighter'; // 多粒子叠加更亮
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        // 重力 + 阻尼
        p.vy += 0.06;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.011;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        const c = p.hue === 0 ? accent : accent2;
        const r = p.size * (p.life * 0.9 + 0.2);
        // 辉光圆（径向渐变）
        const grad = partCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4);
        grad.addColorStop(0,    `rgba(${c[0]},${c[1]},${c[2]},${p.life * 0.95})`);
        grad.addColorStop(0.4,  `rgba(${c[0]},${c[1]},${c[2]},${p.life * 0.4})`);
        grad.addColorStop(1,    `rgba(${c[0]},${c[1]},${c[2]},0)`);
        partCtx.fillStyle = grad;
        partCtx.beginPath();
        partCtx.arc(p.x, p.y, r * 4, 0, Math.PI * 2);
        partCtx.fill();
        // 内核亮点
        partCtx.fillStyle = `rgba(255,255,255,${p.life * 0.85})`;
        partCtx.beginPath();
        partCtx.arc(p.x, p.y, r * 0.5, 0, Math.PI * 2);
        partCtx.fill();
      }
      partCtx.globalCompositeOperation = 'source-over';
    };

    const drawIdle = (accent: number[]) => {
      ringCtx.clearRect(0, 0, ringRect.width, ringRect.height);
      const cx = ringRect.width / 2, cy = ringRect.height / 2;
      const baseR = Math.min(cx, cy) * 0.55;
      ringCtx.strokeStyle = `rgba(${accent.join(',')}, 0.35)`;
      ringCtx.lineWidth = 1.5;
      const bars = 96;
      for (let i = 0; i < bars; i++) {
        const a = (i / bars) * Math.PI * 2;
        const v = (Math.sin(phase + i * 0.2) + 1) / 2;
        const r1 = baseR + 6;
        const r2 = baseR + 6 + v * 18;
        ringCtx.beginPath();
        ringCtx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ringCtx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
        ringCtx.stroke();
      }
      waveCtx.clearRect(0, 0, waveRect.width, waveRect.height);
      waveCtx.strokeStyle = `rgba(${accent.join(',')}, 0.3)`;
      waveCtx.lineWidth = 1.5;
      waveCtx.beginPath();
      for (let x = 0; x < waveRect.width; x += 4) {
        const y = waveRect.height/2 + Math.sin(phase * 2 + x * 0.04) * 4;
        if (x === 0) waveCtx.moveTo(x, y); else waveCtx.lineTo(x, y);
      }
      waveCtx.stroke();
      phase += 0.04;
    };

    const draw = () => {
      const accent = readVar('--accent', [120, 180, 255]);
      const accent2 = readVar('--accent-2', [220, 120, 255]);
      const analyser = getAnalyser();
      if (!analyser) {
        drawIdle(accent);
        updateAndDrawParticles(accent, accent2);
      } else {
        const N = analyser.frequencyBinCount;
        const freq = new Uint8Array(N);
        const time = new Uint8Array(N);
        analyser.getByteFrequencyData(freq);
        analyser.getByteTimeDomainData(time);

        // 计算低频能量（前 8 段）
        let bass = 0;
        for (let i = 0; i < 8; i++) bass += freq[i];
        bass = bass / (8 * 255); // 0..1
        const delta = bass - lastBass;
        lastBass = lastBass * 0.85 + bass * 0.15;
        if (bass > 0.55 && delta > 0.06) {
          spawnBurst(bass, accent, accent2);
        }

        // 圆形径向频谱
        ringCtx.clearRect(0, 0, ringRect.width, ringRect.height);
        const cx = ringRect.width / 2, cy = ringRect.height / 2;
        const baseR = Math.min(cx, cy) * 0.55;
        const bars = 128;
        for (let i = 0; i < bars; i++) {
          const idx = Math.floor((i / bars) * (N * 0.7));
          const v = freq[idx] / 255;
          const a = (i / bars) * Math.PI * 2 - Math.PI / 2;
          const r1 = baseR + 4;
          const r2 = baseR + 4 + v * Math.min(cx, cy) * 0.55;
          const t = i / bars;
          const r = Math.round(accent[0] * (1 - t) + accent2[0] * t);
          const g = Math.round(accent[1] * (1 - t) + accent2[1] * t);
          const b = Math.round(accent[2] * (1 - t) + accent2[2] * t);
          ringCtx.strokeStyle = `rgba(${r},${g},${b},${0.4 + v * 0.6})`;
          ringCtx.lineWidth = 2.4;
          ringCtx.lineCap = 'round';
          ringCtx.beginPath();
          ringCtx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
          ringCtx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
          ringCtx.stroke();
        }

        // 时域波形
        waveCtx.clearRect(0, 0, waveRect.width, waveRect.height);
        const grad = waveCtx.createLinearGradient(0, 0, waveRect.width, 0);
        grad.addColorStop(0, `rgba(${accent.join(',')}, 0.85)`);
        grad.addColorStop(1, `rgba(${accent2.join(',')}, 0.85)`);
        waveCtx.strokeStyle = grad;
        waveCtx.lineWidth = 2;
        waveCtx.beginPath();
        const step = waveRect.width / N;
        for (let i = 0; i < N; i++) {
          const v = (time[i] - 128) / 128;
          const x = i * step;
          const y = waveRect.height / 2 + v * waveRect.height * 0.4;
          if (i === 0) waveCtx.moveTo(x, y);
          else waveCtx.lineTo(x, y);
        }
        waveCtx.stroke();

        // 粒子
        updateAndDrawParticles(accent, accent2);
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <main className={`main glass-soft discover ${immersive ? 'immersive' : ''}`}>
      <div className="discover-head">
        <div>
          <div className="greeting">DISCOVER · 沉浸聆听</div>
          <h1>{current ? current.title : '挑一首歌开始'}</h1>
          <p>{current ? `${current.artist}${current.album ? ' · ' + current.album : ''}` : '从首页选歌后回到这里，感受频谱'}</p>
        </div>
        <button className="immersive-btn" onClick={() => setImmersive(!immersive)} title={immersive ? '退出沉浸' : '进入全屏沉浸'}>
          {immersive ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}
          <span>{immersive ? '退出沉浸' : '沉浸模式'}</span>
        </button>
      </div>

      <div className="vis-stage">
        <canvas ref={particleCanvasRef} className="vis-particles" />
        <canvas ref={ringCanvasRef} className="vis-ring" />
        <div className="vis-center">
          {current && (
            <img
              className={`disc ${isPlaying ? 'spinning' : ''}`}
              src={current.cover}
              alt=""
            />
          )}
          <button className="big-play" onClick={togglePlay} title={isPlaying ? '暂停' : '播放'}>
            {isPlaying ? <Pause size={22} fill="currentColor"/> : <Play size={22} fill="currentColor"/>}
          </button>
        </div>

        {/* 歌词面板 */}
        {lyrics.length > 0 && (
          <div className="lyrics-panel" ref={lyricsRef}>
            <div className="lyrics-fade-top" />
            <div className="lyrics-list">
              {lyrics.map((l, i) => (
                <div
                  key={i}
                  data-idx={i}
                  className={`lyric-line ${i === activeIdx ? 'active' : ''} ${i < activeIdx ? 'past' : ''}`}
                >
                  {l.text}
                </div>
              ))}
            </div>
            <div className="lyrics-fade-bot" />
          </div>
        )}
      </div>

      <canvas ref={waveCanvasRef} className="vis-wave" />

      <div className="vis-tip">
        ✨ 提示：右上角点「沉浸模式」会隐藏左右栏；低频能量大时会爆出粒子；歌词随播放进度自动滚动。
        <div className="hotkeys">
          <kbd>Space</kbd> 播放/暂停
          <kbd>←</kbd>/<kbd>→</kbd> 切歌
          <kbd>↑</kbd>/<kbd>↓</kbd> 音量
          <kbd>F</kbd> 沉浸
          <kbd>D</kbd> 切发现/首页
          <kbd>Esc</kbd> 退出沉浸
        </div>
      </div>
    </main>
  );
}

function readVar(name: string, fallback: [number, number, number]): [number, number, number] {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parts = v.split(/\s+/).map(n => parseInt(n, 10));
  if (parts.length === 3 && parts.every(n => !isNaN(n))) return parts as [number, number, number];
  return fallback;
}
