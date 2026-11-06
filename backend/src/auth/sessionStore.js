import { createHash, randomBytes } from 'node:crypto';
import Redis from 'ioredis';

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

/**
 * Opaque session tokens backed by Redis.
 *
 * The browser only ever sees a random 256-bit token in an HttpOnly cookie; the
 * Redis key stores the SHA-256 of that token, so a Redis dump cannot be replayed
 * as a session. TTL is sliding: every authenticated request pushes the expiry
 * back to `ttlSeconds`.
 */
export class SessionStore {
  constructor({ client, keyPrefix, ttlSeconds, logger }) {
    this.client = client;
    this.prefix = keyPrefix;
    this.ttlSeconds = ttlSeconds;
    this.logger = logger;
  }

  get available() {
    return this.client.status === 'ready';
  }

  keyFor(token) {
    return `${this.prefix}:auth:session:${hashToken(token)}`;
  }

  async create(adminId) {
    const token = randomBytes(32).toString('base64url');
    await this.client.set(
      this.keyFor(token),
      JSON.stringify({ adminId, createdAt: new Date().toISOString() }),
      'EX',
      this.ttlSeconds,
    );
    return token;
  }

  async get(token) {
    if (!token) return null;
    const raw = await this.client.get(this.keyFor(token));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async touch(token) {
    try {
      await this.client.expire(this.keyFor(token), this.ttlSeconds);
    } catch (error) {
      this.logger.warn('Session refresh failed', { error: error.message });
    }
  }

  async destroy(token) {
    if (!token) return;
    try {
      await this.client.del(this.keyFor(token));
    } catch (error) {
      this.logger.warn('Session deletion failed', { error: error.message });
    }
  }

  async close() {
    try {
      if (['ready', 'connecting'].includes(this.client.status)) await this.client.quit();
      else this.client.disconnect();
    } catch {
      this.client.disconnect();
    }
  }
}

export async function createSessionStore(redisConfig, sessionConfig, logger) {
  const client = new Redis(redisConfig.url, {
    db: redisConfig.database,
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    retryStrategy: (attempt) => Math.min(attempt * 300, 5000),
  });

  client.on('error', (error) => {
    logger.warn('Redis session store error', { error: error.message });
  });
  client.on('ready', () => logger.info('Session store ready'));

  try {
    await client.connect();
  } catch (error) {
    logger.warn('Session store unavailable at startup; sign-in will fail until Redis returns', {
      error: error.message,
    });
  }

  return new SessionStore({
    client,
    keyPrefix: redisConfig.keyPrefix,
    ttlSeconds: sessionConfig.ttlSeconds,
    logger,
  });
}
