// 音频生成路由 - 为每首歌动态生成演示音频
import { Router } from 'express';
import { generateWavBuffer, getPresetForTrack } from '../services/audioSynthesis.js';

const router = Router();

// 简单内存缓存，避免重复生成
const audioCache = new Map();

/**
 * GET /api/audio/:trackId
 * 返回对应歌曲的合成 WAV 音频
 */
router.get('/:trackId', (req, res) => {
  const { trackId } = req.params;

  if (audioCache.has(trackId)) {
    const cached = audioCache.get(trackId);
    res.set('Content-Type', 'audio/wav');
    res.set('Content-Length', cached.length);
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'public, max-age=86400');
    return res.send(cached);
  }

  try {
    const preset = getPresetForTrack(trackId);
    const wavBuffer = generateWavBuffer(preset);
    audioCache.set(trackId, wavBuffer);

    res.set('Content-Type', 'audio/wav');
    res.set('Content-Length', wavBuffer.length);
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(wavBuffer);
  } catch (err) {
    console.error('音频生成失败:', err);
    res.status(500).json({ error: '音频生成失败' });
  }
});

export { router as audioRouter };
