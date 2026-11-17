// 推荐API路由
import { Router } from 'express';
import { getRecommendations } from '../services/recommendEngine.js';

const router = Router();

/**
 * POST /api/recommend
 * 根据心情、天气、场景推荐音乐
 */
router.post('/', async (req, res) => {
  try {
    const { mood, weather, scene, userId, options } = req.body;

    if (!mood && !scene) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMS',
          message: '请提供心情描述或场景描述',
        },
      });
    }

    const result = await getRecommendations({
      mood: mood || '',
      weather: weather || 'sunny',
      scene: scene || '',
      userId: userId || 'anonymous',
      options: options || {},
    });

    res.json(result);
  } catch (error) {
    console.error('推荐API错误:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RECOMMENDATION_FAILED',
        message: '推荐服务暂时不可用，请稍后重试',
      },
    });
  }
});

export { router as recommendRouter };
