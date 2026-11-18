import { useEffect, useRef } from 'react';
import { getAnalyser } from '../lib/audioVisualizer';

// 圆形径向频谱环（方向 B 的点缀）：
// 有真实音频时读 analyser 的频段数据；没接音频时画一条缓慢起伏的静态环。
export function SpectrumRing() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    let raf = 0;
    let phase = 0;

    const setup = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = cv.getBoundingClientRect();
      cv.width = Math.max(1, rect.width * dpr);
      cv.height = Math.max(1, rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return rect;
    };
    let rect = setup();
    const onResize = () => { rect = setup(); };
    window.addEventListener('resize', onResize);

    const draw = () => {
      const accent = readVar('--accent', [120, 180, 255]);
      const accent2 = readVar('--accent-2', [220, 120, 255]);
      const analyser = getAnalyser();
      ctx.clearRect(0, 0, rect.width, rect.height);
      const cx = rect.width / 2, cy = rect.height / 2;
      // 封面是圆形（直径约为 wrap 的 72%），环从封面边缘外侧起
      const baseR = Math.min(cx, cy) * 0.74;
      const bars = 96;

      if (analyser) {
        const N = analyser.frequencyBinCount;
        const freq = new Uint8Array(N);
        analyser.getByteFrequencyData(freq);
        for (let i = 0; i < bars; i++) {
          const idx = Math.floor((i / bars) * (N * 0.7));
          const v = freq[idx] / 255;
          const a = (i / bars) * Math.PI * 2 - Math.PI / 2;
          const r1 = baseR + 4;
          const r2 = baseR + 4 + v * Math.min(cx, cy) * 0.26;
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
          const r1 = baseR + 4;
          const r2 = baseR + 4 + v * 14;
          ctx.strokeStyle = `rgba(${accent.join(',')}, 0.3)`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
          ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
          ctx.stroke();
        }
        phase += 0.04;
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <canvas ref={ref} className="np-ring" aria-hidden />;
}

function readVar(name: string, fallback: [number, number, number]): [number, number, number] {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parts = v.split(/\s+/).map(n => parseInt(n, 10));
  if (parts.length === 3 && parts.every(n => !isNaN(n))) return parts as [number, number, number];
  return fallback;
}
