import type { LyricLine } from '../types';

/**
 * 解析 LRC 格式歌词文本
 *  支持：[mm:ss], [mm:ss.xx], [mm:ss.xxx]
 *  支持：一行多个时间戳：[00:01.00][00:31.00]同一句歌词
 *  自动忽略元数据：[ti:..] [ar:..] [al:..] [by:..] [offset:..]
 */
export function parseLRC(text: string): LyricLine[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const out: LyricLine[] = [];
  // 时间戳正则
  const TIME = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

  for (const raw of lines) {
    if (!raw.trim()) continue;
    // 跳过纯元数据行
    if (/^\[(ti|ar|al|by|offset|length|au|re|ve):/i.test(raw.trim())) continue;

    const stamps: number[] = [];
    let m: RegExpExecArray | null;
    let lastIdx = 0;
    TIME.lastIndex = 0;
    while ((m = TIME.exec(raw)) !== null) {
      const min = parseInt(m[1], 10) || 0;
      const sec = parseInt(m[2], 10) || 0;
      const ms = m[3] ? parseInt(m[3].padEnd(3, '0').slice(0, 3), 10) : 0;
      stamps.push(min * 60 + sec + ms / 1000);
      lastIdx = m.index + m[0].length;
    }
    const text = raw.slice(lastIdx).trim();
    if (!stamps.length) continue;
    for (const t of stamps) out.push({ time: t, text });
  }

  out.sort((a, b) => a.time - b.time);
  // 去除完全重复的时间+文本
  const dedup: LyricLine[] = [];
  for (const l of out) {
    const last = dedup[dedup.length - 1];
    if (!last || last.time !== l.time || last.text !== l.text) dedup.push(l);
  }
  return dedup;
}
