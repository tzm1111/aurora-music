// 天气API路由
import { Router } from 'express';
import { findCities, getLocalWeather, resolveWeatherLocation } from '../services/weatherService.js';

const router = Router();

/**
 * GET /api/weather
 * 获取天气信息
 * 查询参数: city (城市名，可选)
 */
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.get('/cities', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (query.length < 2 || query.length > 80) return res.status(400).json({ success: false, error: { message: '请输入城市名称' } });
  try { res.json({ success: true, cities: await findCities(query) }); }
  catch { res.status(502).json({ success: false, error: { message: '城市查询暂时不可用，请重试' } }); }
});
router.post('/location', async (req, res) => {
  const { latitude, longitude } = req.body || {};
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return res.status(400).json({ success: false, error: { message: '请使用有效的位置' } });
  try { res.json({ success: true, location: await resolveWeatherLocation(latitude, longitude) }); }
  catch { res.status(502).json({ success: false, error: { message: '暂时无法识别所在地区，请手动选择城市或区县。' } }); }
});
router.post('/', async (req, res) => {
  const { latitude, longitude } = req.body || {};
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return res.status(400).json({ success: false, error: { message: '请定位或选择有效的城市' } });
  try { res.json({ success: true, weather: await getLocalWeather(latitude, longitude, req.body.refresh === true) }); }
  catch { res.status(502).json({ success: false, error: { message: '天气暂时无法获取，请稍后重试。' } }); }
});
router.get('/', (_req, res) => res.status(400).json({ success: false, error: { message: '请先定位或选择城市，才能获取当地天气。' } }));

export { router as weatherRouter };
