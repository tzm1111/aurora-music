import { useEffect } from 'react';
import { watchDJQueue } from './djController';

// 随应用常驻，浏览音乐库或频谱时也会提前准备下一段音乐。
export function useAutoDJ() {
  useEffect(() => watchDJQueue(), []);
}
