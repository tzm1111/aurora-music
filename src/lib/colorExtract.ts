// 从图片提取主色 + 副色
// 用 canvas 采样像素，取出现频率较高的两个色块

export type ExtractedPalette = {
  primary: [number, number, number];
  secondary: [number, number, number];
};

const cache = new Map<string, ExtractedPalette>();

export async function extractPalette(url: string): Promise<ExtractedPalette> {
  if (cache.has(url)) return cache.get(url)!;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 50;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(fallback());
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;

        const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 128) continue;
          // 量化到 32 阶以减少桶数
          const key = `${r >> 5}_${g >> 5}_${b >> 5}`;
          const cur = buckets.get(key);
          if (cur) { cur.r += r; cur.g += g; cur.b += b; cur.n += 1; }
          else buckets.set(key, { r, g, b, n: 1 });
        }
        const sorted = [...buckets.values()]
          // 排除接近灰/接近黑
          .map(c => ({ ...c, r: c.r / c.n, g: c.g / c.n, b: c.b / c.n }))
          .map(c => ({ ...c, sat: saturation(c.r, c.g, c.b), lum: 0.299*c.r + 0.587*c.g + 0.114*c.b, n: c.n }))
          .filter(c => c.sat > 0.18 && c.lum > 30 && c.lum < 230)
          .sort((a, b) => (b.n * (0.6 + b.sat)) - (a.n * (0.6 + a.sat)));
        const top = sorted[0];
        const second = sorted.find(c => colorDist(c, top) > 80) ?? sorted[1] ?? top;
        if (!top) return resolve(fallback());
        const palette: ExtractedPalette = {
          primary: [Math.round(top.r), Math.round(top.g), Math.round(top.b)],
          secondary: [Math.round(second.r), Math.round(second.g), Math.round(second.b)],
        };
        cache.set(url, palette);
        resolve(palette);
      } catch {
        resolve(fallback());
      }
    };
    img.onerror = () => resolve(fallback());
    img.src = url;
  });
}

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}
function colorDist(a: {r:number;g:number;b:number}, b: {r:number;g:number;b:number}): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}
function fallback(): ExtractedPalette {
  return { primary: [80, 130, 220], secondary: [200, 80, 200] };
}

export function applyPaletteToCSS(p: ExtractedPalette) {
  const root = document.documentElement;
  root.style.setProperty('--accent', `${p.primary[0]} ${p.primary[1]} ${p.primary[2]}`);
  root.style.setProperty('--accent-2', `${p.secondary[0]} ${p.secondary[1]} ${p.secondary[2]}`);
  // 背景色稍暗一点的衬底
  root.style.setProperty('--bg-0', `${Math.round(p.primary[0]*0.18)} ${Math.round(p.primary[1]*0.18)} ${Math.round(p.primary[2]*0.18 + 8)}`);
  root.style.setProperty('--bg-1', `${Math.round(p.secondary[0]*0.10)} ${Math.round(p.secondary[1]*0.10)} ${Math.round(p.secondary[2]*0.10 + 8)}`);
}
