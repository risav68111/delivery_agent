import { config } from './config.js';
import { createApp } from './app.js';
import { createAdminRepository } from './auth/adminRepository.js';
import { ensureAdminUser } from './auth/bootstrap.js';
import { createSessionStore } from './auth/sessionStore.js';
import { createCache } from './cache.js';
import { createDatabase } from './database.js';
import { applySchema } from './db/schema.js';
import { createLogger } from './logger.js';

const logger = createLogger({ level: config.logLevel, pretty: !config.isProduction });
const db = createDatabase(config.db, logger);
const cache = await createCache(config.redis, config.cache, logger);

const adminRepository = createAdminRepository(db);
const sessions = await createSessionStore(config.redis, config.session, logger);

async function waitForDatabase(attempts = 10, delayMs = 1500) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await db.ping();
      return;
    } catch (error) {
      logger.warn(`PostgreSQL not ready (attempt ${attempt}/${attempts})`, {
        error: error.message,
      });
      if (attempt === attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function start() {
  await waitForDatabase();
  await applySchema(db);
  logger.info('Database schema ready');

  await ensureAdminUser({ adminRepository, config, logger });

  const app = createApp({ config, db, cache, logger, sessions, adminRepository });

  const server = app.listen(config.port, config.host, () => {
    logger.info(`API listening on http://127.0.0.1:${config.port}${config.apiPrefix}`, {
      env: config.env,
      cache: cache.available ? 'redis' : 'disabled',
    });
  });

  server.on('error', async (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${config.port} is already in use`);
    } else {
      logger.error('HTTP server error', { error: error.message });
    }
    await shutdown('server-error', 1);
  });

  let shuttingDown = false;
  async function shutdown(reason, exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Shutting down', { reason });

    const forceExit = setTimeout(() => process.exit(exitCode || 1), 10_000);
    forceExit.unref();

    server.close(async () => {
      try {
        await sessions.close();
        await cache.close();
        await db.close();
      } finally {
        process.exit(exitCode);
      }
    });
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch(async (error) => {
  logger.error('Failed to start API', { error: error.message });
  try {
    await sessions.close();
    await cache.close();
    await db.close();
  } finally {
    process.exit(1);
  }
});
