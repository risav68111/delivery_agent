import Redis from 'ioredis';

const VERSION_KEY = 'agents:version';

export { RedisCache };

/**
 * Redis-backed cache with a versioned key space.
 *
 * Every write bumps `dam:agents:version`. List and stats keys embed the current
 * version (`dam:agents:v7:list:<hash>`), so bumping the version makes every
 * previously cached collection unreachable in O(1) without scanning Redis.
 * The orphaned keys simply expire through their TTL. Individual agent entries
 * live outside the version space (`dam:agents:item:<id>`) and are deleted
 * explicitly on update/delete.
 *
 * ioredis is used because the local Redis build is 3.0, which does not support
 * the RESP3 `HELLO` handshake required by node-redis v4+.
 */
class RedisCache {
  constructor({ client, keyPrefix, cache, logger }) {
    this.client = client;
    this.prefix = keyPrefix;
    this.cache = cache;
    this.logger = logger;
    this.inflight = new Map();
  }

  get available() {
    return this.client?.status === 'ready';
  }

  get versionKey() {
    return `${this.prefix}:${VERSION_KEY}`;
  }

  listKey(version, hash) {
    return `${this.prefix}:agents:v${version}:list:${hash}`;
  }

  statsKey(version) {
    return `${this.prefix}:agents:v${version}:stats`;
  }

  agentKey(id) {
    return `${this.prefix}:agents:item:${id}`;
  }

  async currentVersion() {
    if (!this.available) return 0;
    try {
      const raw = await this.client.get(this.versionKey);
      return Number.parseInt(raw ?? '0', 10) || 0;
    } catch (error) {
      this.onError('read version', error);
      return 0;
    }
  }

  async getJson(key) {
    if (!this.available) return null;
    try {
      const raw = await this.client.get(key);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch (error) {
      this.onError('read', error);
      return null;
    }
  }

  async setJson(key, value, ttlSeconds) {
    if (!this.available) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', Math.max(1, Math.floor(ttlSeconds)));
    } catch (error) {
      this.onError('write', error);
    }
  }

  /**
   * Read-through helper with per-process single-flight protection so a burst of
   * identical requests only loads the database once.
   */
  async load(key, ttlSeconds, loader) {
    const cached = await this.getJson(key);
    if (cached !== null) {
      return { value: cached.value, hit: true };
    }

    const pending = this.inflight.get(key);
    if (pending) {
      const result = await pending;
      return { value: result.value, hit: false };
    }

    const promise = this.fill(key, ttlSeconds, loader);
    this.inflight.set(key, promise);
    try {
      const result = await promise;
      return { value: result.value, hit: false };
    } finally {
      this.inflight.delete(key);
    }
  }

  async fill(key, ttlSeconds, loader) {
    const result = await loader();
    await this.setJson(key, { value: result.value }, result.ttlSeconds ?? ttlSeconds);
    return result;
  }

  /**
   * Invalidates everything derived from the agents collection: bump the version
   * (lists, stats) and drop the specific agent entry if one was provided.
   */
  async invalidate(keys = []) {
    if (!this.available) return;
    try {
      const multi = this.client.multi().incr(this.versionKey);
      for (const key of keys) multi.del(key);
      await multi.exec();
    } catch (error) {
      this.onError('invalidate', error);
    }
  }

  async ping() {
    if (!this.available) return false;
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  /** Test helper: wipes the configured Redis logical database. */
  async flush() {
    if (!this.available) return;
    await this.client.flushdb();
  }

  async close() {
    try {
      if (this.client?.status === 'ready' || this.client?.status === 'connecting') {
        await this.client.quit();
      } else {
        this.client?.disconnect();
      }
    } catch {
      this.client?.disconnect();
    }
  }

  onError(action, error) {
    this.logger.warn(`Redis ${action} failed; serving from PostgreSQL`, {
      error: error?.message ?? String(error),
    });
  }
}

function createNoopCache() {
  return {
    available: false,
    listKey: (_version, hash) => `noop:list:${hash}`,
    statsKey: () => 'noop:stats',
    agentKey: (id) => `noop:item:${id}`,
    async currentVersion() {
      return 0;
    },
    async load(_key, _ttl, loader) {
      const result = await loader();
      return { value: result.value, hit: false };
    },
    async invalidate() {},
    async flush() {},
    async ping() {
      return false;
    },
    async close() {},
  };
}

export async function createCache(redisConfig, cacheConfig, logger) {
  if (!redisConfig.enabled) {
    logger.warn('Redis caching is disabled (REDIS_ENABLED=false)');
    return createNoopCache();
  }

  const client = new Redis(redisConfig.url, {
    db: redisConfig.database,
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    retryStrategy: (attempt) => Math.min(attempt * 300, 5000),
  });

  client.on('error', (error) => {
    logger.warn('Redis client error', { error: error.message });
  });
  client.on('ready', () => logger.info('Redis connection ready'));
  client.on('end', () => logger.warn('Redis connection closed'));

  // Do not block start-up on Redis: failures degrade to PostgreSQL reads.
  try {
    await client.connect();
  } catch (error) {
    logger.warn('Redis unavailable at startup; API will serve without cache', {
      error: error.message,
    });
  }

  return new RedisCache({
    client,
    keyPrefix: redisConfig.keyPrefix,
    cache: cacheConfig,
    logger,
  });
}
