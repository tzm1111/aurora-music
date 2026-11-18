import 'dotenv/config';
import app from './app.js';
const PORT = process.env.PORT || 3001;
// 启动服务器
const server = app.listen(PORT, process.env.HOST || '127.0.0.1', () => {
  console.log(`🎵 Aurora Music Server running on http://localhost:${PORT}`);
  console.log(`   LLM Provider: ${process.env.LLM_PROVIDER || 'disabled'}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});
process.on('SIGTERM', () => server.close());

export default app;
