import 'dotenv/config';
import app from '../server/src/app.js';
process.env.NETEASE_EMBEDDED = '1';
export default app;
