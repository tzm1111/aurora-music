import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { recommendRouter } from './routes/recommend.js';
import { musicRouter } from './routes/music.js';
import { weatherRouter } from './routes/weather.js';
import { chatRouter } from './routes/chat.js';
import { audioRouter } from './routes/audio.js';
import { accountRouter } from './routes/account.js';
import { djRouter } from './routes/dj.js';

const app = express();
const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

// 中间件
app.use(cors({ origin: ['http://127.0.0.1:5173', 'http://localhost:5173'], credentials: true }));
app.use(express.json());

// 路由
app.use('/api/recommend', recommendRouter);
app.use('/api/music', musicRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/chat', chatRouter);
app.use('/api/audio', audioRouter);
app.use('/api/account', accountRouter);
app.use('/api/dj', djRouter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      llm: process.env.LLM_PROVIDER || 'disabled',
      music: process.env.NETEASE_MUSIC_API_URL ? 'configured' : 'disabled',
      neteaseApi: process.env.NETEASE_MUSIC_API_URL || 'http://localhost:3100',
      weather: 'open-meteo / met-norway',
    },
  });
});

// 生产环境由同一个服务提供网页与 API，账号 Cookie 保持同源。
if (process.env.SERVE_STATIC === '1') {
  const dist = fileURLToPath(new URL('../../dist/', import.meta.url));
  app.use(express.static(dist, { index: false }));
  app.get('/{*page}', (req, res, next) => {
    if (req.path.startsWith('/api/') || path.extname(req.path)) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

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
const server = app.listen(PORT, process.env.HOST || '127.0.0.1', () => {
  console.log(`🎵 Aurora Music Server running on http://localhost:${PORT}`);
  console.log(`   LLM Provider: ${process.env.LLM_PROVIDER || 'disabled'}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});
process.on('SIGTERM', () => server.close());

export default app;
