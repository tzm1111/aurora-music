import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { recommendRouter } from './routes/recommend.js';
import { musicRouter } from './routes/music.js';
import { weatherRouter } from './routes/weather.js';
import { chatRouter } from './routes/chat.js';
import { audioRouter } from './routes/audio.js';

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());

// 路由
app.use('/api/recommend', recommendRouter);
app.use('/api/music', musicRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/chat', chatRouter);
app.use('/api/audio', audioRouter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      llm: process.env.LLM_PROVIDER || 'disabled',
      music: process.env.NETEASE_MUSIC_API_URL ? 'configured' : 'disabled',
      neteaseApi: process.env.NETEASE_MUSIC_API_URL || 'http://localhost:3100',
      weather: process.env.WEATHER_API_KEY ? 'configured' : 'disabled',
    },
  });
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    },
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🎵 Aurora Music Server running on http://localhost:${PORT}`);
  console.log(`   LLM Provider: ${process.env.LLM_PROVIDER || 'disabled'}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
