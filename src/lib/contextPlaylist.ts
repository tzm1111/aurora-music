import { buildContextMix } from '../../shared/contextMix.js';
import { useLocalWeather } from '../store/useLocalWeather';
import type { LocalWeather } from '../store/useLocalWeather';

export function contextPlaylist(now = new Date(), data: LocalWeather | null = useLocalWeather.getState().data) {
  // 不使用播放器的演示天气；定位失败或数据过期时只按真实本地时间选歌。
  const age = data ? now.getTime() - data.fetchedAt : Infinity;
  const fresh = data && Number.isFinite(age) && age >= 0 && age < 30 * 60 * 1000;
  const temperature = fresh && Number.isFinite(data.temperature) ? data.temperature : null;
  return buildContextMix({
    date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    weekday: now.getDay(), hour: now.getHours(), weather: fresh ? data.type : null,
    temperatureBand: temperature === null ? null : temperature <= 10 ? 'cold' : temperature >= 28 ? 'hot' : 'mild',
  })!;
}
