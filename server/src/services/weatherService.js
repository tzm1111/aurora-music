const cache = new Map();
async function request(base, params, options = {}) {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const response = await fetch(url, { headers: options.headers, signal: AbortSignal.timeout(options.timeout || 10000) });
  if (!response.ok) throw new Error('天气服务暂时不可用');
  return response.json();
}
const placeCache = new Map();
export function placeFromFeature(feature, coordinates) {
  const p = feature?.properties || {};
  const point = coordinates || feature?.geometry?.coordinates;
  if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) return null;
  const district = [p.city, p.county, p.district, p.name].find(value => typeof value === 'string' && /[区县]$/.test(value)) || (p.countrycode === 'CN' || p.country === '中国' ? '' : p.district || p.county || '');
  const namedCity = p.osm_key === 'place' && ['city', 'town', 'village'].includes(p.osm_value) && p.name !== district ? p.name : '';
  const city = p.city && p.city !== district ? p.city : namedCity || p.state || '';
  const name = district || namedCity || city || p.state;
  if (!name) return null;
  return { name, city, district, region: [...new Set([p.state, city, p.country].filter(Boolean))].join(' · '),
    latitude: Math.round(point[1] * 100) / 100, longitude: Math.round(point[0] * 100) / 100 };
}
export async function resolveWeatherLocation(latitude, longitude) {
  const lat = Math.round(latitude * 100) / 100, lon = Math.round(longitude * 100) / 100;
  const key = `${lat},${lon}`;
  if (placeCache.has(key)) return placeCache.get(key);
  const data = await request('https://photon.komoot.io/reverse', { lat, lon, limit: 1 }, { timeout: 8000 });
  // 只保留行政地区，不返回街道、门牌和附近兴趣点。
  const location = placeFromFeature(data.features?.[0], [lon, lat]);
  if (!location) throw new Error('暂时无法识别地区，请手动选择');
  placeCache.set(key, location);
  if (placeCache.size > 100) placeCache.delete(placeCache.keys().next().value);
  return location;
}
export async function findCities(query) {
  try {
    const data = await request('https://photon.komoot.io/api/', { q: query, limit: 8 }, { timeout: 6000 });
    const administrative = (data.features || []).filter(feature => ['place', 'boundary'].includes(feature.properties?.osm_key));
    const rows = (administrative.length ? administrative : data.features || []).map(feature => placeFromFeature(feature)).filter(Boolean);
    const unique = [...new Map(rows.map(row => [[row.city, row.district, row.name].join('|'), row])).values()].slice(0, 5);
    if (unique.length) return unique;
  } catch { /* 城市查询有备用来源，区域识别失败时不编造区县名称。 */ }
  const data = await request('https://geocoding-api.open-meteo.com/v1/search', { name: query, count: 5, language: 'zh', format: 'json' });
  return (data.results || []).map(city => ({ name: city.name, city: city.name, district: [city.admin3, city.admin2, city.name].find(value => /[区县]$/.test(value || '')) || '', region: [city.admin1, city.country].filter(Boolean).join(' · '), latitude: city.latitude, longitude: city.longitude }));
}
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
export function describeWeather(code, day = true) {
  if (code === 0) return { type: day ? 'sunny' : 'night', label: day ? '晴朗' : '晴夜' };
  if ([1, 2, 3].includes(code)) return { type: 'cloudy', label: code === 3 ? '阴天' : '多云' };
  if ([45, 48].includes(code)) return { type: 'cloudy', label: '有雾' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { type: 'snowy', label: '降雪' };
  if ([95, 96, 99].includes(code)) return { type: 'rainy', label: '雷雨' };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { type: 'rainy', label: '降雨' };
  return { type: 'cloudy', label: '天气更新中' };
}
export function airQualityLabel(aqi) {
  if (aqi === null) return '暂不可用';
  return aqi <= 50 ? '优' : aqi <= 100 ? '中等' : aqi <= 150 ? '敏感人群不宜' : aqi <= 200 ? '不健康' : aqi <= 300 ? '很不健康' : '危险';
}
export function travelTips(weather) {
  const tips = [];
  if ([95, 96, 99].includes(weather.code)) tips.push('有雷雨，避免在空旷处或树下停留。');
  else if (weather.type === 'snowy') tips.push('有降雪，注意路滑，出门穿防滑鞋。');
  else if (weather.precipitation > 0 || weather.type === 'rainy') tips.push('正在降雨，带上雨伞，注意湿滑路面。');
  else if (weather.rainProbability !== null && weather.rainProbability >= 40) tips.push('未来 6 小时可能下雨，带把伞更稳妥。');
  else if (weather.nextRainAmount > 0) tips.push('未来 6 小时预计有降水，出门带把伞。');
  if ([45, 48].includes(weather.code)) tips.push('有雾，出行留意能见度，驾驶时放慢速度。');
  if (weather.airQuality.aqi !== null && weather.airQuality.aqi > 100) tips.push('空气质量欠佳，减少长时间户外运动，敏感人群注意防护。');
  if (weather.windSpeed !== null && weather.windSpeed >= 35) tips.push('风较大，骑行和高处活动注意安全。');
  if (weather.feelsLike !== null && weather.feelsLike <= 10) tips.push('体感偏冷，出门带件外套。');
  if (weather.feelsLike !== null && weather.feelsLike >= 30) tips.push('体感较热，带水补水，尽量避开暴晒。');
  if (weather.isDay && weather.uvMax !== null && weather.uvMax >= 6) tips.push('今天紫外线较强，白天外出注意防晒。');
  if (!tips.length) tips.push('暂未发现明显出行影响，出门前再留意天气变化。');
  return tips;
}
export function summarizeWeather(forecast, air) {
  const current = forecast.current;
  if (!current || number(current.temperature_2m) === null || number(current.weather_code) === null) throw new Error('天气数据暂不完整');
  const hours = forecast.hourly?.time || [];
  const found = hours.findIndex(time => time >= current.time);
  const start = found < 0 ? hours.length : found;
  const probabilities = (forecast.hourly?.precipitation_probability || []).slice(start, start + 6).map(number).filter(value => value !== null);
  const aqi = number(air?.current?.us_aqi);
  const weather = {
    ...describeWeather(current.weather_code, current.is_day === 1), code: current.weather_code,
    temperature: current.temperature_2m, feelsLike: number(current.apparent_temperature),
    precipitation: number(current.precipitation), windSpeed: number(current.wind_speed_10m),
    rainProbability: probabilities.length ? Math.max(...probabilities) : null,
    uvMax: number(forecast.daily?.uv_index_max?.[0]), isDay: current.is_day === 1,
    observedAt: current.time, timezone: forecast.timezone,
    airQuality: { aqi, label: airQualityLabel(aqi), pm25: number(air?.current?.pm2_5), observedAt: air?.current?.time || null },
  };
  return { ...weather, tips: travelTips(weather), fetchedAt: Date.now(), source: 'Open-Meteo', airSource: 'CAMS / US AQI' };
}
export function summarizeMET(forecast, air) {
  const times = forecast.properties?.timeseries || [];
  const current = [...times].reverse().find(item => Date.parse(item.time) <= Date.now()) || times[0];
  const details = current?.data?.instant?.details;
  if (!details || number(details.air_temperature) === null) throw new Error('天气数据暂不完整');
  const symbol = current.data.next_1_hours?.summary?.symbol_code || current.data.next_6_hours?.summary?.symbol_code || '';
  const code = /thunder/.test(symbol) ? 95 : /snow|sleet/.test(symbol) ? 71 : /rain/.test(symbol) ? 61 : /fog/.test(symbol) ? 45 : /clearsky/.test(symbol) ? 0 : /fair/.test(symbol) ? 1 : /partlycloudy/.test(symbol) ? 2 : 3;
  const aqi = number(air?.current?.us_aqi);
  const timezone = air?.timezone || 'UTC';
  const observedAt = new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(current.time)).replace(' ', 'T');
  const weather = {
    ...describeWeather(code, !symbol.endsWith('_night')), code,
    temperature: details.air_temperature, feelsLike: null, precipitation: null,
    windSpeed: number(details.wind_speed) === null ? null : details.wind_speed * 3.6,
    rainProbability: number(current.data.next_6_hours?.details?.probability_of_precipitation),
    nextRainAmount: number(current.data.next_6_hours?.details?.precipitation_amount), uvMax: null,
    isDay: !symbol.endsWith('_night'), observedAt, timezone,
    airQuality: { aqi, label: airQualityLabel(aqi), pm25: number(air?.current?.pm2_5), observedAt: air?.current?.time || null },
  };
  return { ...weather, tips: travelTips(weather), fetchedAt: Date.now(), source: 'MET Norway', airSource: 'CAMS / US AQI' };
}
export async function getLocalWeather(latitude, longitude, force = false) {
  // 只查询约 1 公里精度的位置，不保存设备的精确坐标。
  const lat = Math.round(latitude * 100) / 100, lon = Math.round(longitude * 100) / 100;
  const key = `${lat},${lon}`;
  const previous = cache.get(key);
  if (!force && previous && Date.now() - previous.fetchedAt < 10 * 60 * 1000) return previous;
  const common = { latitude: lat, longitude: lon, timezone: 'auto' };
  const results = await Promise.allSettled([
    request('https://api.open-meteo.com/v1/forecast', { ...common, current: 'temperature_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m', hourly: 'precipitation_probability', daily: 'uv_index_max', forecast_days: 2 }, { timeout: 5000 }),
    request('https://air-quality-api.open-meteo.com/v1/air-quality', { ...common, current: 'us_aqi,pm2_5', forecast_days: 1 }),
  ]);
  const air = results[1].status === 'fulfilled' ? results[1].value : null;
  const weather = results[0].status === 'fulfilled' ? summarizeWeather(results[0].value, air) : summarizeMET(await request('https://api.met.no/weatherapi/locationforecast/2.0/compact', { lat, lon }, { headers: { 'User-Agent': 'AuroraMusic/1.0 https://github.com/tzm1111/aurora-music' } }), air);
  cache.set(key, weather);
  if (cache.size > 100) cache.delete(cache.keys().next().value);
  return weather;
}
