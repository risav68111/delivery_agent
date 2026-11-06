import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, beforeEach, describe, it } from 'node:test';

import { createApp } from '../src/app.js';
import { createAdminRepository } from '../src/auth/adminRepository.js';
import { hashPassword } from '../src/auth/password.js';
import { createSessionStore } from '../src/auth/sessionStore.js';
import { createCache } from '../src/cache.js';
import { createDatabase } from '../src/database.js';
import { applySchema } from '../src/db/schema.js';
import { createLogger } from '../src/logger.js';

const config = {
  env: 'test',
  apiPrefix: '/api/v1',
  corsOrigin: '*',
  db: {
    connectionString:
      process.env.TEST_DATABASE_URL ??
      'postgres://risavkr:2345@127.0.0.1:5432/delivery_agents_test',
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    ssl: false,
  },
  redis: {
    enabled: true,
    url: process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:6379',
    database: 1,
    keyPrefix: 'dam:test',
  },
  cache: {
    listTtlSeconds: 60,
    detailTtlSeconds: 120,
    statsTtlSeconds: 60,
    negativeTtlSeconds: 5,
  },
  session: { ttlSeconds: 3600, cookieName: 'dispatch.sid', secure: false },
  admin: { email: 'admin@test.local', password: 'TestPassword123!', fullName: 'Test Admin' },
};

const EMAIL = 'admin@test.local';
const PASSWORD = 'TestPassword123!';

const logger = createLogger({ level: 'error', pretty: false });
const db = createDatabase(config.db, logger);
const cache = await createCache(config.redis, config.cache, logger);
const sessions = await createSessionStore(config.redis, config.session, logger);
const adminRepository = createAdminRepository(db);
const app = createApp({ config, db, cache, logger, sessions, adminRepository });

await applySchema(db);

const server = app.listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;

async function request(path, { method = 'GET', body, cookie, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body: text ? JSON.parse(text) : null,
  };
}

async function signIn(email = EMAIL, password = PASSWORD) {
  const response = await request('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  const setCookie = response.headers.get('set-cookie');
  return { response, cookie: setCookie ? setCookie.split(';')[0] : null };
}

beforeEach(async () => {
  await db.query('DELETE FROM admin_users');
  await adminRepository.create({
    id: randomUUID(),
    fullName: 'Test Admin',
    email: EMAIL,
    passwordHash: hashPassword(PASSWORD),
  });

  const sessionKeys = await cache.client.keys('dam:test:auth:*');
  if (sessionKeys.length > 0) await cache.client.del(...sessionKeys);
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await sessions.close();
  await cache.close();
  await db.close();
});

describe('POST /auth/login', () => {
  it('signs in an admin and sets an HttpOnly session cookie', async () => {
    const { response, cookie } = await signIn();

    assert.equal(response.status, 200);
    assert.equal(response.body.data.email, EMAIL);
    assert.equal(response.body.data.role, 'admin');
    assert.equal(response.body.data.password_hash, undefined);
    assert.equal(response.body.data.passwordHash, undefined);
    assert.ok(response.body.data.lastLoginAt);

    const setCookie = response.headers.get('set-cookie');
    assert.match(setCookie, /dispatch\.sid=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    assert.match(setCookie, /Max-Age=3600/i);
    assert.ok(cookie?.startsWith('dispatch.sid='));
  });

  it('rejects a wrong password with 401 without revealing which field was wrong', async () => {
    const { response } = await signIn(EMAIL, 'definitely-wrong');

    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, 'INVALID_CREDENTIALS');
    assert.equal(response.body.error.message, 'Incorrect email or password.');
  });

  it('rejects an unknown email with the same generic error', async () => {
    const { response } = await signIn('nobody@test.local', PASSWORD);

    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, 'INVALID_CREDENTIALS');
    assert.equal(response.body.error.message, 'Incorrect email or password.');
  });

  it('validates the request body', async () => {
    const response = await request('/auth/login', {
      method: 'POST',
      body: { email: 'not-an-email' },
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
    const fields = response.body.error.details.map((detail) => detail.field);
    assert.deepEqual(new Set(fields), new Set(['email', 'password']));
  });
});

describe('session protection', () => {
  it('rejects agent requests without a session', async () => {
    const response = await request('/agents');
    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, 'AUTH_REQUIRED');
  });

  it('rejects an invalid session cookie', async () => {
    const response = await request('/agents', { cookie: 'dispatch.sid=not-a-real-token' });
    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, 'AUTH_REQUIRED');
  });

  it('accepts the session cookie on /auth/me and agent routes', async () => {
    const { cookie } = await signIn();

    const me = await request('/auth/me', { cookie });
    assert.equal(me.status, 200);
    assert.equal(me.body.data.email, EMAIL);

    const agents = await request('/agents', { cookie });
    assert.equal(agents.status, 200);
    assert.ok(Array.isArray(agents.body.data));
  });

  it('keeps /health public', async () => {
    const response = await request('/health');
    assert.equal(response.status, 200);
    assert.equal(response.body.checks.database, 'up');
  });
});

describe('POST /auth/logout', () => {
  it('destroys the session and expires the cookie', async () => {
    const { cookie } = await signIn();
    assert.equal((await request('/auth/me', { cookie })).status, 200);

    const logout = await request('/auth/logout', { method: 'POST', cookie });
    assert.equal(logout.status, 204);
    assert.match(logout.headers.get('set-cookie'), /dispatch\.sid=;/);
    assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970|Max-Age=0/i);

    const me = await request('/auth/me', { cookie });
    assert.equal(me.status, 401);
    assert.equal(me.body.error.code, 'AUTH_REQUIRED');
  });

  it('is idempotent without a session', async () => {
    const response = await request('/auth/logout', { method: 'POST' });
    assert.equal(response.status, 204);
  });
});

describe('login rate limiting', () => {
  it('locks out after repeated failures for the same email', async () => {
    const email = 'locked@test.local';

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await request('/auth/login', {
        method: 'POST',
        body: { email, password: 'wrong-password' },
      });
      assert.equal(response.status, 401);
    }

    const blocked = await request('/auth/login', {
      method: 'POST',
      body: { email, password: 'wrong-password' },
    });

    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.error.code, 'TOO_MANY_ATTEMPTS');
  });
});
