const app = require('./app');
const { pool, testConnection } = require('./config/db');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.startsWith('replace_with')) {
  console.warn('WARNING: JWT_SECRET is missing or still set to the placeholder value in .env. Set a real secret before deploying.');
}

(async () => {
  await testConnection();
  const server = app.listen(PORT, () => {
    console.log(`Faculty Gate Out Pass API running on http://localhost:${PORT}`);
  });

  const shutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      await pool.end();
      console.log('Server closed, DB pool drained. Bye.');
      process.exit(0);
    });
    // Force-exit if something hangs
    setTimeout(() => process.exit(1), 8000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
})();
