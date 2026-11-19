import { useEffect, useState } from 'react';
import { useLocalWeather } from '../store/useLocalWeather';
import { contextPlaylist } from './contextPlaylist';

export function useContextPlaylist() {
  const weather = useLocalWeather(s => s.data);
  const [, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => { if (document.visibilityState === 'visible') setNow(new Date()); };
    const timer = setInterval(update, 60_000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update); };
  }, []);
  return contextPlaylist(new Date(), weather);
}
