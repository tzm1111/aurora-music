import { create } from 'zustand';
import { apiRequest } from '../services/api';
import { usePlayer } from './usePlayer';
import type { Weather } from '../types';
export type WeatherLocation = { name: string; latitude: number; longitude: number; region?: string; city?: string; district?: string; kind?: 'device' | 'manual' };
export type LocalWeather = {
  type: Weather; label: string; temperature: number; feelsLike: number | null; precipitation: number | null;
  windSpeed: number | null; rainProbability: number | null; uvMax: number | null; observedAt: string;
  nextRainAmount?: number | null;
  fetchedAt: number; timezone: string; source: string; airSource: string; tips: string[];
  airQuality: { aqi: number | null; label: string; pm25: number | null; observedAt: string | null };
};
type WeatherState = { location: WeatherLocation | null; data: LocalWeather | null; busy: boolean; error: string | null; locationError: string | null };
export const useLocalWeather = create<WeatherState>(() => ({ location: null, data: null, busy: false, error: null, locationError: null }));
let generation = 0;
let controller: AbortController | null = null;
export async function loadLocalWeather(location: WeatherLocation, refresh = false) {
  const ticket = ++generation;
  controller?.abort(); controller = new AbortController();
  const rounded = { ...location, latitude: Math.round(location.latitude * 100) / 100, longitude: Math.round(location.longitude * 100) / 100 };
  const previous = useLocalWeather.getState().location;
  const same = previous?.latitude === rounded.latitude && previous?.longitude === rounded.longitude;
  useLocalWeather.setState({ location: rounded, busy: true, error: null, locationError: null, ...(same ? {} : { data: null }) });
  try {
    const signal = controller.signal;
    const resolveLocation = rounded.kind === 'device' && !rounded.district
      ? apiRequest<{ location: WeatherLocation }>('/api/weather/location', { latitude: rounded.latitude, longitude: rounded.longitude }, signal).then(result => {
        if (ticket === generation) {
          useLocalWeather.setState({ location: { ...result.location, kind: 'device' } });
          usePlayer.setState({ city: result.location.city || result.location.name });
        }
      }).catch(() => { if (ticket === generation) useLocalWeather.setState({ locationError: '暂时无法识别区县，可手动选择地区。' }); })
      : Promise.resolve();
    const weather = apiRequest<{ weather: LocalWeather }>('/api/weather', { latitude: rounded.latitude, longitude: rounded.longitude, refresh }, signal);
    // 地区识别与天气独立完成；一项失败不会隐藏另一项的真实结果。
    await Promise.all([weather.then(result => {
      if (ticket !== generation) return;
      useLocalWeather.setState({ data: result.weather });
      usePlayer.setState({ weather: result.weather.type, temperatureC: Math.round(result.weather.temperature), city: useLocalWeather.getState().location?.city || rounded.name });
    }), resolveLocation]);
  } catch (error) {
    if (ticket === generation) useLocalWeather.setState({ error: error instanceof Error ? error.message : '天气暂时无法获取' });
  } finally { if (ticket === generation) useLocalWeather.setState({ busy: false }); }
}
export function locateWeather() {
  if (!navigator.geolocation) { useLocalWeather.setState({ error: '浏览器不支持定位，请手动选择城市。' }); return; }
  const ticket = ++generation;
  controller?.abort();
  useLocalWeather.setState({ busy: true, error: null });
  navigator.geolocation.getCurrentPosition(position => {
    if (ticket !== generation) return;
    void loadLocalWeather({ name: '当前位置', kind: 'device', latitude: position.coords.latitude, longitude: position.coords.longitude });
  }, error => {
    if (ticket !== generation) return;
    useLocalWeather.setState({ busy: false, error: error.code === 1 ? '定位未获授权，可以允许定位或手动选择城市。' : '暂时无法定位，请重试或手动选择城市。' });
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 15 * 60 * 1000 });
}
