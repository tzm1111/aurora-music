import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Cloud, CloudRain, Sun, Snowflake, Moon, MapPin, X, RefreshCw, Umbrella, Wind, LoaderCircle, Search, ChevronDown } from 'lucide-react';
import { useLocalWeather, loadLocalWeather, locateWeather, startWeatherUpdates, refreshCurrentWeather } from '../store/useLocalWeather';
import type { WeatherLocation } from '../store/useLocalWeather';
import { apiRequest } from '../services/api';
import { useDialogFocus } from '../lib/useDialogFocus';
const ICONS = { sunny: Sun, cloudy: Cloud, rainy: CloudRain, snowy: Snowflake, night: Moon };
const placeLabel = (location: WeatherLocation | null) => location ? [...new Set([location.city, location.district || location.name].filter(Boolean))].join(' · ') : '位置';

function WeatherPopover({ anchor, onClose }: { anchor: RefObject<HTMLButtonElement | null>; onClose: () => void }) {
  const { data, location, busy, error, locationError } = useLocalWeather();
  const [query, setQuery] = useState('');
  const [cities, setCities] = useState<WeatherLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const [cityError, setCityError] = useState('');
  const [position, setPosition] = useState({ top: 110, right: 16, maxHeight: 450 });
  const search = useRef<AbortController | null>(null);
  const panel = useDialogFocus(onClose);
  useEffect(() => () => search.current?.abort(), []);
  useEffect(() => {
    const update = () => {
      const box = anchor.current?.getBoundingClientRect();
      const top = Math.min(box?.bottom || 102, window.innerHeight - 180) + 8;
      setPosition({ top, right: Math.max(12, window.innerWidth - (box?.right || window.innerWidth - 12)), maxHeight: window.innerHeight - top - 16 });
    };
    update(); window.addEventListener('resize', update);
    const outside = (event: PointerEvent) => { if (!panel.current?.contains(event.target as Node) && !anchor.current?.contains(event.target as Node)) onClose(); };
    document.addEventListener('pointerdown', outside, true);
    return () => { window.removeEventListener('resize', update); document.removeEventListener('pointerdown', outside, true); };
  }, [anchor, onClose, panel]);
  const find = async () => {
    search.current?.abort(); const ctrl = new AbortController(); search.current = ctrl;
    setSearching(true); setCityError(''); setCities([]);
    try {
      const result = await apiRequest<{ cities: WeatherLocation[] }>('/api/weather/cities?q=' + encodeURIComponent(query.trim()), undefined, ctrl.signal);
      if (!ctrl.signal.aborted) { setCities(result.cities); if (!result.cities.length) setCityError('未找到地区'); }
    } catch (e) { if (!ctrl.signal.aborted) setCityError(e instanceof Error ? e.message : '地区查询失败'); }
    finally { if (!ctrl.signal.aborted) setSearching(false); }
  };
  return createPortal(<div ref={panel} className="weather-popover" role="dialog" aria-label="位置与天气" tabIndex={-1} style={position}>
    <div className="weather-popover-head"><div><small>{location?.kind === 'manual' ? '已选择地区' : '当前位置'}</small><h2>{placeLabel(location)}</h2></div><button aria-label="关闭天气面板" onClick={onClose}><X size={17}/></button></div>
    {locationError && <details className="weather-small-note"><summary>定位详情</summary><p>{locationError}</p></details>}
    {data && <><div className="weather-popover-summary"><span>{Math.round(data.temperature)}° · {data.label}</span><span>空气 {data.airQuality.aqi === null ? '暂不可用' : `${data.airQuality.label} · ${Math.round(data.airQuality.aqi)}`}</span></div></>}
    {(busy || error) && <p className={`weather-small-note ${error ? 'weather-small-error' : ''}`} role="status">{busy ? '正在更新位置与天气…' : error}</p>}
    <div className="weather-location-actions"><button disabled={busy} onClick={locateWeather}><MapPin size={14}/>{location ? '重新定位' : '定位'}</button>{location && <button disabled={busy} aria-label="刷新天气" onClick={() => void loadLocalWeather(location, true)}><RefreshCw size={14}/></button>}</div>
    <form className="weather-place-search" onSubmit={event => { event.preventDefault(); void find(); }}><input aria-label="搜索城市或区县" value={query} onChange={event => setQuery(event.target.value)} placeholder="城市或区县" maxLength={80}/><button aria-label="搜索地区" disabled={searching || query.trim().length < 2}>{searching ? <LoaderCircle className="spin" size={16}/> : <Search size={16}/>}</button></form>
    {cityError && <p className="weather-small-note weather-small-error" role="status">{cityError}</p>}
    <div className="weather-place-results">{cities.map(city => <button key={`${city.latitude},${city.longitude}`} disabled={busy} onClick={() => { void loadLocalWeather({ ...city, kind: 'manual' }); setCities([]); setQuery(''); }}><b>{placeLabel(city)}</b><small>{city.region}</small></button>)}</div>
    <p className="weather-small-source">{data && <span>{data.source} · US AQI · </span>}<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a></p>
  </div>, document.body);
}

export function WeatherWidget() {
  const { data, location, busy, error } = useLocalWeather();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [slide, setSlide] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const entries = useMemo(() => {
    if (!data) return [{ Icon: Cloud, text: error ? '天气不可用' : '天气' }];
    return [{ Icon: ICONS[data.type] || Cloud, text: `${Math.round(data.temperature)}° · ${data.label}` },
      { Icon: Umbrella, text: data.rainProbability !== null ? `6h 降雨 ${data.rainProbability}%` : data.nextRainAmount != null ? `6h 降水 ${data.nextRainAmount} mm` : '降雨预报暂不可用' },
      { Icon: Wind, text: data.airQuality.aqi === null ? '空气质量暂不可用' : `空气 ${data.airQuality.label} · ${Math.round(data.airQuality.aqi)}` }];
  }, [data, error]);
  useEffect(() => {
    if (open || hovered || entries.length < 2) return;
    const timer = setInterval(() => { if (!document.hidden) setSlide(value => (value + 1) % entries.length); }, 5000);
    return () => clearInterval(timer);
  }, [open, hovered, entries.length]);
  useEffect(startWeatherUpdates, []);
  useEffect(() => { if (open) refreshCurrentWeather(); }, [open]);
  const entry = entries[slide % entries.length];
  return <div className="weather-status-area">
    <button ref={trigger} className={`weather-status-strip ${open ? 'expanded' : ''}`} aria-label={`天气与位置：${placeLabel(location)}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(value => !value)} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setHovered(true)} onBlur={() => setHovered(false)}>
      <span className="weather-status-location"><MapPin size={13}/><span>{placeLabel(location)}</span></span><span className="weather-status-divider"/>
      <span className="weather-status-fact" key={busy ? 'busy' : entry.text}>{busy ? <LoaderCircle className="spin" size={14}/> : <entry.Icon size={14}/>}<span>{busy ? '更新中' : entry.text}</span></span>
      <span className="weather-status-dots" aria-hidden="true">{entries.map((_, index) => <i key={index} className={index === slide % entries.length ? 'active' : ''}/>)}</span><ChevronDown className="weather-status-chevron" size={13}/>
    </button>
    {open && <WeatherPopover anchor={trigger} onClose={close}/>}
  </div>;
}
