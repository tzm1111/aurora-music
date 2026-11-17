// 推荐引擎 - 整合LLM理解 + 本地匹配 + 降级策略
import { MUSIC_LIBRARY, getDefaultTracks } from '../data/musicLibrary.js';
import { MOOD_MAPPINGS, detectMood } from '../data/moodMappings.js';
import { WEATHER_MAPPINGS } from '../data/weatherMappings.js';
import { matchAndRankTracks } from '../utils/matcher.js';
import { callLLM } from '../services/llmService.js';

// 内存缓存
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30分钟

/**
 * 生成缓存键
 */
function generateCacheKey(mood, weather, scene) {
  const data = JSON.stringify({ mood, weather, scene });
  return Buffer.from(data).toString('base64').substring(0, 32);
}

/**
 * 检查缓存
 */
function checkCache(key) {
  const cached = cache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return cached.data;
}

/**
 * 写入缓存
 */
function setCache(key, data) {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * 构建推荐目标参数
 */
function buildTargetParams(mood, weather, scene) {
  const detectedMood = detectMood(mood);
  const moodConfig = MOOD_MAPPINGS[detectedMood] || MOOD_MAPPINGS.calm;
  const weatherConfig = WEATHER_MAPPINGS[weather] || WEATHER_MAPPINGS.sunny;

  // 合并心情和天气的流派推荐
  const genres = [...new Set([...moodConfig.genres, ...(weatherConfig.genreBoost || [])])];
  const tags = [...new Set([...moodConfig.tags, ...(weatherConfig.tags || [])])];

  // 能量和情感价目标
  const energy = (moodConfig.energyRange[0] + moodConfig.energyRange[1]) / 2 + (weatherConfig.moodModulation?.energy || 0);
  const valence = (moodConfig.valenceRange[0] + moodConfig.valenceRange[1]) / 2 + (weatherConfig.moodModulation?.valence || 0);

  return {
    genres,
    tags,
    mood: detectedMood,
    energy: Math.max(1, Math.min(10, energy)),
    valence: Math.max(1, Math.min(10, valence)),
  };
}

/**
 * 生成DJ风格的开场白
 */
function generateDJIntro(mood, weather, scene) {
  const weatherDescriptions = {
    sunny: '阳光明媚',
    rainy: '细雨绵绵',
    cloudy: '云淡风轻',
    snowy: '雪花飘落',
    stormy: '风雨交加',
  };

  const moodEmojis = {
    happy: '😊',
    sad: '🌧️',
    calm: '🍃',
    anxious: '🫧',
    nostalgic: '✨',
    romantic: '💫',
    focused: '🎯',
    energetic: '⚡',
    lonely: '🌙',
    stressed: '🌿',
  };

  const detectedMood = detectMood(mood);
  const weatherDesc = weatherDescriptions[weather] || '微风拂面';
  const emoji = moodEmojis[detectedMood] || '🎵';

  const intros = [
    `${emoji} ${weatherDesc}的时刻，让音乐陪伴你${scene || '享受此刻'}...`,
    `${emoji} 为你精选了一些适合${weatherDesc}时听的歌曲，希望能带来好心情！`,
    `${emoji} 这个${weatherDesc}的午后，来听听音乐放松一下吧...`,
  ];

  return intros[Math.floor(Math.random() * intros.length)];
}

/**
 * 主要推荐函数
 * @param {Object} params - { mood, weather, scene, userId, options }
 * @returns {Object} 推荐结果
 */
export async function getRecommendations(params) {
  const { mood, weather = 'sunny', scene, userId, options = {} } = params;
  const { count = 8, useCache = true } = options;

  const startTime = Date.now();

  // 检查缓存
  if (useCache) {
    const cacheKey = generateCacheKey(mood, weather, scene);
    const cached = checkCache(cacheKey);
    if (cached) {
      return {
        ...cached,
        metadata: {
          ...cached.metadata,
          cacheHit: true,
        },
      };
    }
  }

  try {
    // 尝试LLM推荐（如果启用）
    if (process.env.LLM_PROVIDER && process.env.LLM_PROVIDER !== 'disabled') {
      try {
        const llmResult = await getLLMRecommendation(mood, weather, scene);
        if (llmResult) {
          const result = {
            success: true,
            source: 'llm',
            context: llmResult.context,
            djIntro: llmResult.djIntro || generateDJIntro(mood, weather, scene),
            tracks: llmResult.tracks,
            metadata: {
              totalTracks: MUSIC_LIBRARY.length,
              returnedTracks: llmResult.tracks.length,
              cacheHit: false,
              llmLatency: Date.now() - startTime,
            },
          };

          // 写入缓存
          if (useCache) {
            const cacheKey = generateCacheKey(mood, weather, scene);
            setCache(cacheKey, result);
          }

          return result;
        }
      } catch (llmError) {
        console.warn('LLM推荐失败，降级到本地推荐:', llmError.message);
      }
    }

    // 本地推荐（降级方案）
    const localResult = await getLocalRecommendation(mood, weather, scene, count);

    const result = {
      success: true,
      source: 'local',
      context: {
        mood: detectMood(mood),
        weather,
        scene,
      },
      djIntro: generateDJIntro(mood, weather, scene),
      tracks: localResult.tracks,
      metadata: {
        totalTracks: MUSIC_LIBRARY.length,
        returnedTracks: localResult.tracks.length,
        cacheHit: false,
        matchLatency: Date.now() - startTime,
      },
    };

    // 写入缓存
    if (useCache) {
      const cacheKey = generateCacheKey(mood, weather, scene);
      setCache(cacheKey, result);
    }

    return result;
  } catch (error) {
    console.error('推荐引擎错误:', error);

    // 最终兜底：返回默认热门歌曲
    return {
      success: true,
      source: 'fallback',
      message: '使用默认推荐',
      djIntro: '🎵 为你精选了一些热门歌曲，希望你喜欢！',
      tracks: getDefaultTracks(count),
      metadata: {
        totalTracks: MUSIC_LIBRARY.length,
        returnedTracks: count,
        cacheHit: false,
        error: error.message,
      },
    };
  }
}

/**
 * LLM推荐（如果启用）
 */
async function getLLMRecommendation(mood, weather, scene) {
  // 调用LLM服务
  const llmResponse = await callLLM(mood, weather, scene);

  if (!llmResponse || !llmResponse.tracks) {
    return null;
  }

  return llmResponse;
}

/**
 * 本地推荐（基于规则和匹配）
 */
async function getLocalRecommendation(mood, weather, scene, count) {
  const targetParams = buildTargetParams(mood, weather, scene);

  // 从音乐库中匹配和排序
  const tracks = matchAndRankTracks(MUSIC_LIBRARY, targetParams, { count });

  return { tracks };
}
