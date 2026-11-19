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
const REFRESH_INTERVAL = 15 * 60 * 1000;
let lastLocationAttempt = 0;
let locationPermission: PermissionState | undefined;
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
  lastLocationAttempt = Date.now();
  controller?.abort();
  useLocalWeather.setState({ busy: true, error: null, locationError: null });
  navigator.geolocation.getCurrentPosition(position => {
    if (ticket !== generation) return;
    locationPermission = 'granted';
    void loadLocalWeather({ name: '当前位置', kind: 'device', latitude: position.coords.latitude, longitude: position.coords.longitude }, true);
  }, error => {
    if (ticket !== generation) return;
    if (error.code === 1) locationPermission = 'denied';
    const message = error.code === 1 ? '定位未获授权，请在浏览器的网站设置中允许定位，或手动选择地区。' : '暂时无法定位，请重试或手动选择地区。';
    const location = useLocalWeather.getState().location;
    if (location) {
      // 定位失败时仍更新已知地区的天气。
      void loadLocalWeather(location, true).then(() => {
        if (generation === ticket + 1) useLocalWeather.setState({ locationError: message });
      });
    } else useLocalWeather.setState({ busy: false, error: message, locationError: message });
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
}

export function refreshCurrentWeather(force = false) {
  const state = useLocalWeather.getState();
  if (state.busy) return;
  const stale = !state.data || Date.now() - state.data.fetchedAt >= REFRESH_INTERVAL;
  if (!state.location || state.location.kind === 'device') {
    if (locationPermission !== 'denied' && (force || Date.now() - lastLocationAttempt >= REFRESH_INTERVAL)) {
      locateWeather();
      return;
    }
  }
  if (state.location && (force || stale)) void loadLocalWeather(state.location, true);
}

// 一个订阅管理首页和 DJ 页，避免 StrictMode 或切换视图重复申请定位。
let weatherSubscribers = 0;
let stopUpdates: (() => void) | undefined;
export function startWeatherUpdates() {
  if (++weatherSubscribers === 1) {
    let stopped = false;
    let permission: PermissionStatus | undefined;
    const onPermissionChange = () => {
      if (!permission || stopped) return;
      locationPermission = permission.state;
      if (permission.state === 'granted') refreshCurrentWeather(true);
    };
    const initialize = () => {
      if (stopped) return;
      if (locationPermission === 'denied' && !useLocalWeather.getState().location) {
        useLocalWeather.setState({ error: '请在浏览器的网站设置中允许定位，或手动选择地区。' });
      } else refreshCurrentWeather(!useLocalWeather.getState().data);
    };
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' }).then(status => {
        if (stopped) return;
        permission = status; locationPermission = status.state;
        permission.addEventListener('change', onPermissionChange);
        initialize();
      }).catch(initialize);
    } else initialize();
    const onVisible = () => { if (document.visibilityState === 'visible') refreshCurrentWeather(); };
    const timer = setInterval(onVisible, REFRESH_INTERVAL);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    stopUpdates = () => {
      stopped = true; clearInterval(timer);
      permission?.removeEventListener('change', onPermissionChange);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }
  let released = false;
  return () => { if (!released && --weatherSubscribers === 0) stopUpdates?.(); released = true; };
}
