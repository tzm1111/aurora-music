import { AnimatePresence, motion } from 'framer-motion';
import type { ExtractedPalette } from '../lib/colorExtract';

const FALLBACK: ExtractedPalette = { primary: [80, 130, 220], secondary: [200, 80, 200] };

// 封面色 mesh 渐变背景：换歌时整层 1.2s 交叉淡入淡出；
// 播放时光斑缓慢漂移呼吸，暂停时静止。
export function MeshBackground({ palette, isPlaying }: { palette: ExtractedPalette | null; isPlaying: boolean }) {
  const p = palette ?? FALLBACK;
  const key = `${p.primary.join(',')}|${p.secondary.join(',')}`;
  const [r1, g1, b1] = p.primary;
  const [r2, g2, b2] = p.secondary;
  const bg0 = `${Math.round(r1 * 0.16)} ${Math.round(g1 * 0.16)} ${Math.round(b1 * 0.16 + 10)}`;
  const bg1 = `${Math.round(r2 * 0.09)} ${Math.round(g2 * 0.09)} ${Math.round(b2 * 0.09 + 10)}`;

  return (
    <div className={`mesh-bg ${isPlaying ? 'playing' : ''}`} aria-hidden>
      <AnimatePresence>
        <motion.div
          key={key}
          className="mesh-layer"
          style={{
            background:
              `radial-gradient(ellipse 70% 55% at 18% 8%, rgba(${r1},${g1},${b1},0.55), transparent 65%),` +
              `radial-gradient(ellipse 65% 55% at 85% 92%, rgba(${r2},${g2},${b2},0.5), transparent 65%),` +
              `radial-gradient(ellipse 45% 40% at 70% 15%, rgba(${r2},${g2},${b2},0.28), transparent 70%),` +
              `linear-gradient(160deg, rgb(${bg0}) 0%, rgb(${bg1}) 100%)`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
        >
          <div className="mesh-blob blob-a" style={{ background: `radial-gradient(circle, rgba(${r1},${g1},${b1},0.5), transparent 70%)` }} />
          <div className="mesh-blob blob-b" style={{ background: `radial-gradient(circle, rgba(${r2},${g2},${b2},0.45), transparent 70%)` }} />
        </motion.div>
      </AnimatePresence>
      <div className="mesh-grain" />
    </div>
  );
}
