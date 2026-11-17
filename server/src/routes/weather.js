// 天气API路由
import { Router } from 'express';
import { getMockWeather } from '../data/weatherMappings.js';

const router = Router();

/**
 * GET /api/weather
 * 获取天气信息
 * 查询参数: city (城市名，可选)
 */
router.get('/', async (req, res) => {
  try {
    const { city } = req.query;

    // 如果配置了天气API，调用真实API
    if (process.env.WEATHER_API_KEY && process.env.WEATHER_API_KEY !== 'your_openweather_api_key_here') {
      // TODO: 接入真实天气API
      // const weather = await callWeatherAPI(city);
      // res.json({ success: true, weather });
    }

    // 使用模拟数据
    const weather = getMockWeather();
    if (city) {
      weather.location = city;
    }

    res.json({
      success: true,
      weather,
      source: 'mock',
      message: '当前使用模拟天气数据，配置WEATHER_API_KEY后可获取真实天气',
    });
  } catch (error) {
    console.error('天气查询错误:', error);
    res.status(500).json({
      success: false,
      error: { message: '天气查询失败' },
    });
  }
});

export { router as weatherRouter };
