import { usePlayer } from '../store/usePlayer';
import { useVisualMotion } from '../lib/useVisualMotion';
import { useEffect, useRef } from 'react';
import { getAnalyser } from '../lib/audioVisualizer';
import { fitCanvas, ringGeometry } from '../lib/canvasLayout';

// 圆形径向频谱环（方向 B 的点缀）：
// 有真实音频时读 analyser 的频段数据；没接音频时画一条缓慢起伏的静态环。
export function SpectrumRing() {
  const playing = usePlayer(s => s.isPlaying);
  const palette = usePlayer(s => s.palette);
  const animate = useVisualMotion(playing);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    let raf = 0;
    let phase = 0;

    const setup = () => fitCanvas(cv, ctx);
    let rect = setup();
    const onResize = () => { rect = setup(); if (!animate) draw(); };
    const observer = new ResizeObserver(onResize);
    observer.observe(cv);

    const accent = readVar('--accent', [120, 180, 255]);
    const accent2 = readVar('--accent-2', [220, 120, 255]);
    let freq = new Uint8Array(0);
    const draw = () => {
      const analyser = animate ? getAnalyser() : null;
      ctx.clearRect(0, 0, rect.width, rect.height);
      const { cx, cy, baseRadius, amplitude } = ringGeometry(rect.width, rect.height, Math.min(rect.width, rect.height) * .36);
      const bars = 96;

      if (analyser) {
        const N = analyser.frequencyBinCount;
        if (freq.length !== N) freq = new Uint8Array(N);
        analyser.getByteFrequencyData(freq);
        for (let i = 0; i < bars; i++) {
          const idx = Math.floor((i / bars) * (N * 0.7));
          const v = freq[idx] / 255;
          const a = (i / bars) * Math.PI * 2 - Math.PI / 2;
          const r1 = baseRadius;
          const r2 = baseRadius + v * amplitude;
          const t = i / bars;
          const r = Math.round(accent[0] * (1 - t) + accent2[0] * t);
          const g = Math.round(accent[1] * (1 - t) + accent2[1] * t);
          const b = Math.round(accent[2] * (1 - t) + accent2[2] * t);
          ctx.strokeStyle = `rgba(${r},${g},${b},${0.35 + v * 0.65})`;
          ctx.lineWidth = 2.4;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
          ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
          ctx.stroke();
        }
      } else {
        for (let i = 0; i < bars; i++) {
          const a = (i / bars) * Math.PI * 2;
          const v = (Math.sin(phase + i * 0.2) + 1) / 2;
          const r1 = baseRadius;
          const r2 = baseRadius + v * Math.min(14, amplitude);
          ctx.strokeStyle = `rgba(${accent.join(',')}, 0.3)`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
          ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
          ctx.stroke();
        }
        phase += 0.04;
      }
      if (animate) raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [animate, palette]);

  return <canvas ref={ref} className="np-ring" aria-hidden />;
}

function readVar(name: string, fallback: [number, number, number]): [number, number, number] {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parts = v.split(/\s+/).map(n => parseInt(n, 10));
  if (parts.length === 3 && parts.every(n => !isNaN(n))) return parts as [number, number, number];
  return fallback;
}
