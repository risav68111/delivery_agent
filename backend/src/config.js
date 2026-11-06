import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv({ path: path.join(backendRoot, '.env'), quiet: true });

function toInt(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const env = process.env.NODE_ENV ?? 'development';

/**
 * Single source of truth for runtime configuration.
 * Every value can be overridden through environment variables / backend/.env.
 */
export const config = Object.freeze({
  env,
  isProduction: env === 'production',
  host: process.env.HOST ?? '0.0.0.0',
  port: toInt(process.env.PORT, 4000),
  apiPrefix: '/api/v1',
  logLevel: process.env.LOG_LEVEL ?? (env === 'test' ? 'error' : 'info'),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',

  db: {
    connectionString:
      process.env.DATABASE_URL ??
      'postgres://risavkr:2345@127.0.0.1:5432/delivery_agents',
    max: toInt(process.env.DB_POOL_MAX, 10),
    connectionTimeoutMillis: toInt(process.env.DB_CONNECT_TIMEOUT_MS, 5000),
    idleTimeoutMillis: toInt(process.env.DB_IDLE_TIMEOUT_MS, 30000),
    ssl: toBool(process.env.DB_SSL, false),
  },

  redis: {
    enabled: toBool(process.env.REDIS_ENABLED, true),
    url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
    database: toInt(process.env.REDIS_DB, 0),
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'dam',
  },

  cache: {
    listTtlSeconds: toInt(process.env.CACHE_LIST_TTL_SECONDS, 60),
    detailTtlSeconds: toInt(process.env.CACHE_DETAIL_TTL_SECONDS, 120),
    statsTtlSeconds: toInt(process.env.CACHE_STATS_TTL_SECONDS, 60),
    negativeTtlSeconds: toInt(process.env.CACHE_NEGATIVE_TTL_SECONDS, 10),
  },

  session: {
    ttlSeconds: toInt(process.env.SESSION_TTL_SECONDS, 8 * 60 * 60),
    cookieName: process.env.SESSION_COOKIE_NAME ?? 'dispatch.sid',
    secure: toBool(process.env.SESSION_COOKIE_SECURE, env === 'production'),
  },

  admin: {
    email: process.env.ADMIN_EMAIL ?? 'admin@dispatch.local',
    password: process.env.ADMIN_PASSWORD ?? 'Admin@12345',
    fullName: process.env.ADMIN_NAME ?? 'Operations Admin',
  },
});
