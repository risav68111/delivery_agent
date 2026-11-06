import express from 'express';

export function createHealthRouter({ db, cache }) {
  const router = express.Router();

  router.get('/', async (_req, res) => {
    const checks = { database: 'down', redis: 'down' };

    try {
      await db.ping();
      checks.database = 'up';
    } catch {
      checks.database = 'down';
    }

    checks.redis = (await cache.ping()) ? 'up' : 'down';

    const databaseUp = checks.database === 'up';
    const status = databaseUp ? (checks.redis === 'up' ? 'ok' : 'degraded') : 'unhealthy';

    res.status(databaseUp ? 200 : 503).json({
      status,
      checks,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
