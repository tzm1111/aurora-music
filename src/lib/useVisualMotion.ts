import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

export function useVisualMotion(playing: boolean) {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return playing && visible && !reduced;
}
