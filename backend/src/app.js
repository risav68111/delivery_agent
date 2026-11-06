import cors from 'cors';
import express from 'express';
import { createAgentRepository } from './agents/repository.js';
import { createAgentsRouter } from './agents/routes.js';
import { createAgentService } from './agents/service.js';
import { createRequireAuth } from './auth/middleware.js';
import { createAuthRouter } from './auth/routes.js';
import { createAuthService } from './auth/service.js';
import { createHealthRouter } from './health.js';
import { createErrorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createRequestLogger } from './middleware/requestLogger.js';

export function createApp({ config, db, cache, logger, sessions, adminRepository }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  const agentRepository = createAgentRepository(db);
  const agentService = createAgentService({ repository: agentRepository, cache, config, logger });

  const authService = createAuthService({ adminRepository, sessions, logger });
  const requireAuth = createRequireAuth({
    authService,
    cookieName: config.session.cookieName,
  });

  const allowedOrigins =
    config.corsOrigin === '*'
      ? true
      : config.corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);

  app.use(createRequestLogger(logger));
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Cache', 'X-Request-Id', 'Location'],
    }),
  );
  app.use(express.json({ limit: '64kb' }));

  const healthRouter = createHealthRouter({ db, cache });
  app.use('/health', healthRouter);
  app.use(`${config.apiPrefix}/health`, healthRouter);

  app.use(`${config.apiPrefix}/auth`, createAuthRouter({ authService, requireAuth, config }));

  // Every agent endpoint requires a valid admin session.
  app.use(`${config.apiPrefix}/agents`, requireAuth, createAgentsRouter({ service: agentService }));

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
