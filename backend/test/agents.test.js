import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';

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
    enabled: process.env.REDIS_ENABLED !== 'false',
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
  session: {
    ttlSeconds: 3600,
    cookieName: 'dispatch.sid',
    secure: false,
  },
};

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

// Create a dedicated admin and sign in once; the agent tests run against it.
await db.query('DELETE FROM admin_users');
await adminRepository.create({
  id: randomUUID(),
  fullName: 'Test Admin',
  email: 'admin@test.local',
  passwordHash: hashPassword('TestPassword123!'),
});

const loginResponse = await fetch(`${baseUrl}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@test.local', password: 'TestPassword123!' }),
});
if (loginResponse.status !== 200) {
  throw new Error(`Test admin sign-in failed with status ${loginResponse.status}`);
}
const authCookie = loginResponse.headers.get('set-cookie').split(';')[0];

before(async () => {
  assert.equal(cache.available, true, 'Redis must be reachable for the cache tests');
});

beforeEach(async () => {
  await db.query('TRUNCATE TABLE agents');
  // Clear cached agent data (including the version key) but keep the session.
  const agentKeys = await cache.client.keys('dam:test:agents:*');
  if (agentKeys.length > 0) await cache.client.del(...agentKeys);
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await sessions.close();
  await cache.close();
  await db.close();
});

async function api(path, { method = 'GET', body, headers = {}, auth = true } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(auth ? { Cookie: authCookie } : {}),
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

function validAgent(overrides = {}) {
  return {
    fullName: 'Nisha Verma',
    email: `nisha.${randomUUID().slice(0, 8)}@example.com`,
    phone: '+91 98765 43210',
    serviceArea: 'Indiranagar, Bengaluru',
    status: 'active',
    ...overrides,
  };
}

describe('POST /agents', () => {
  it('creates an agent and returns 201 with a Location header', async () => {
    const payload = validAgent();
    const response = await api('/agents', { method: 'POST', body: payload });

    assert.equal(response.status, 201);
    assert.match(response.headers.get('location'), /\/api\/v1\/agents\/[0-9a-f-]{36}$/);
    assert.equal(response.body.data.fullName, payload.fullName);
    assert.equal(response.body.data.email, payload.email);
    assert.equal(response.body.data.status, 'active');
    assert.match(response.body.data.id, /^[0-9a-f-]{36}$/);
    assert.ok(Date.parse(response.body.data.createdAt));
    assert.equal(response.body.data.createdAt, response.body.data.updatedAt);
  });

  it('defaults status to active and reports field-level validation errors', async () => {
    const response = await api('/agents', {
      method: 'POST',
      body: { fullName: 'A', email: 'not-an-email', phone: '123', serviceArea: '', status: 'sleeping' },
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
    const fields = response.body.error.details.map((detail) => detail.field);
    assert.deepEqual(new Set(fields), new Set(['fullName', 'email', 'phone', 'serviceArea', 'status']));
    assert.ok(response.body.requestId);
  });

  it('rejects malformed JSON', async () => {
    const response = await fetch(`${baseUrl}/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ "fullName": ',
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'INVALID_JSON');
  });

  it('rejects duplicate emails case-insensitively with 409', async () => {
    const payload = validAgent({ email: 'duplicate@example.com' });
    assert.equal((await api('/agents', { method: 'POST', body: payload })).status, 201);

    const second = await api('/agents', {
      method: 'POST',
      body: { ...payload, email: 'DUPLICATE@example.com' },
    });

    assert.equal(second.status, 409);
    assert.equal(second.body.error.code, 'CONFLICT');
    assert.equal(second.body.error.details[0].field, 'email');
  });
});

describe('GET /agents', () => {
  it('returns paginated results with metadata', async () => {
    const names = ['Agent One', 'Agent Two', 'Agent Three', 'Agent Four', 'Agent Five'];
    for (const [index, name] of names.entries()) {
      const created = await api('/agents', {
        method: 'POST',
        body: validAgent({ fullName: name, email: `agent${index}@example.com` }),
      });
      assert.equal(created.status, 201);
    }

    const response = await api('/agents?page=2&pageSize=2');

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 2);
    assert.deepEqual(response.body.meta, {
      page: 2,
      pageSize: 2,
      total: 5,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
      sort: 'createdAt',
      order: 'desc',
    });
  });

  it('filters by status and searches by name', async () => {
    const active = await api('/agents', { method: 'POST', body: validAgent({ fullName: 'Zara Khan', email: 'a@example.com', status: 'active' }) });
    const inactive = await api('/agents', { method: 'POST', body: validAgent({ fullName: 'Yash Patel', email: 'i@example.com', status: 'inactive' }) });
    assert.equal(active.status, 201);
    assert.equal(inactive.status, 201);

    const inactiveOnly = await api('/agents?status=inactive');
    assert.equal(inactiveOnly.body.meta.total, 1);
    assert.equal(inactiveOnly.body.data[0].fullName, 'Yash Patel');

    const search = await api('/agents?search=Yash');
    assert.equal(search.body.meta.total, 1);
    assert.equal(search.body.data[0].fullName, 'Yash Patel');

    const noMatch = await api('/agents?search=nobody');
    assert.equal(noMatch.body.meta.total, 0);
  });

  it('rejects invalid pagination parameters', async () => {
    const response = await api('/agents?page=0&pageSize=500&sort=nope');
    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  });

  it('serves stats and distinct service areas', async () => {
    await api('/agents', { method: 'POST', body: validAgent({ email: 'one@example.com', serviceArea: 'Koramangala', status: 'active' }) });
    await api('/agents', { method: 'POST', body: validAgent({ email: 'two@example.com', serviceArea: 'Indiranagar', status: 'inactive' }) });

    const stats = await api('/agents/stats');
    assert.equal(stats.status, 200);
    assert.equal(stats.body.data.total, 2);
    assert.equal(stats.body.data.active, 1);
    assert.equal(stats.body.data.inactive, 1);
    assert.deepEqual(stats.body.data.serviceAreas, ['Indiranagar', 'Koramangala']);

    const areas = await api('/agents/service-areas');
    assert.deepEqual(areas.body.data, ['Indiranagar', 'Koramangala']);
  });
});

describe('GET /agents/:id', () => {
  it('returns a single agent and caches it', async () => {
    const created = await api('/agents', { method: 'POST', body: validAgent() });
    const id = created.body.data.id;

    const first = await api(`/agents/${id}`);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('x-cache'), 'MISS');
    assert.equal(first.body.data.id, id);

    const second = await api(`/agents/${id}`);
    assert.equal(second.headers.get('x-cache'), 'HIT');
    assert.deepEqual(second.body.data, first.body.data);
  });

  it('returns 404 for a valid but unknown id', async () => {
    const response = await api(`/agents/${randomUUID()}`);
    assert.equal(response.status, 404);
    assert.equal(response.body.error.code, 'NOT_FOUND');
  });

  it('returns 400 for a malformed id', async () => {
    const response = await api('/agents/not-a-uuid');
    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, 'BAD_REQUEST');
  });
});

describe('PATCH and PUT /agents/:id', () => {
  it('updates a subset of fields via PATCH', async () => {
    const created = await api('/agents', { method: 'POST', body: validAgent() });
    const id = created.body.data.id;

    const response = await api(`/agents/${id}`, {
      method: 'PATCH',
      body: { status: 'inactive', phone: '+91 90000 12345' },
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, 'inactive');
    assert.equal(response.body.data.phone, '+91 90000 12345');
    assert.equal(response.body.data.fullName, created.body.data.fullName);
    assert.ok(Date.parse(response.body.data.updatedAt) >= Date.parse(created.body.data.updatedAt));
    assert.notEqual(response.body.data.updatedAt, created.body.data.updatedAt);
  });

  it('replaces all mutable fields via PUT', async () => {
    const created = await api('/agents', { method: 'POST', body: validAgent() });
    const id = created.body.data.id;

    const response = await api(`/agents/${id}`, {
      method: 'PUT',
      body: {
        fullName: 'Replaced Name',
        email: 'replaced@example.com',
        phone: '+91 91111 22222',
        serviceArea: 'Whitefield, Bengaluru',
        status: 'inactive',
      },
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.fullName, 'Replaced Name');
    assert.equal(response.body.data.email, 'replaced@example.com');
    assert.equal(response.body.data.serviceArea, 'Whitefield, Bengaluru');
    assert.equal(response.body.data.status, 'inactive');
  });

  it('rejects an empty PATCH body', async () => {
    const created = await api('/agents', { method: 'POST', body: validAgent() });
    const response = await api(`/agents/${created.body.data.id}`, { method: 'PATCH', body: {} });

    assert.equal(response.status, 400);
    assert.equal(response.body.error.details[0].field, 'body');
  });

  it('returns 404 when updating a missing agent', async () => {
    const response = await api(`/agents/${randomUUID()}`, {
      method: 'PATCH',
      body: { status: 'inactive' },
    });
    assert.equal(response.status, 404);
  });
});

describe('DELETE /agents/:id', () => {
  it('deletes an agent and returns 204', async () => {
    const created = await api('/agents', { method: 'POST', body: validAgent() });
    const id = created.body.data.id;

    const deleted = await api(`/agents/${id}`, { method: 'DELETE' });
    assert.equal(deleted.status, 204);

    const fetched = await api(`/agents/${id}`);
    assert.equal(fetched.status, 404);

    const list = await api('/agents');
    assert.equal(list.body.meta.total, 0);
  });

  it('returns 404 when deleting a missing agent', async () => {
    const response = await api(`/agents/${randomUUID()}`, { method: 'DELETE' });
    assert.equal(response.status, 404);
  });
});

describe('Redis caching', () => {
  it('caches the list response and serves it from Redis', async () => {
    await api('/agents', { method: 'POST', body: validAgent() });

    const first = await api('/agents');
    assert.equal(first.headers.get('x-cache'), 'MISS');

    const second = await api('/agents');
    assert.equal(second.headers.get('x-cache'), 'HIT');
    assert.deepEqual(second.body, first.body);
  });

  it('invalidates cached lists when an agent is created', async () => {
    await api('/agents', { method: 'POST', body: validAgent({ email: 'first@example.com' }) });
    assert.equal((await api('/agents')).headers.get('x-cache'), 'MISS');
    assert.equal((await api('/agents')).headers.get('x-cache'), 'HIT');

    await api('/agents', { method: 'POST', body: validAgent({ fullName: 'Second Agent', email: 'second@example.com' }) });

    const refreshed = await api('/agents');
    assert.equal(refreshed.headers.get('x-cache'), 'MISS');
    assert.equal(refreshed.body.meta.total, 2);
  });

  it('invalidates the cached detail when an agent is updated', async () => {
    const created = await api('/agents', { method: 'POST', body: validAgent() });
    const id = created.body.data.id;

    assert.equal((await api(`/agents/${id}`)).headers.get('x-cache'), 'MISS');
    assert.equal((await api(`/agents/${id}`)).headers.get('x-cache'), 'HIT');

    await api(`/agents/${id}`, { method: 'PATCH', body: { serviceArea: 'Jayanagar, Bengaluru' } });

    const afterUpdate = await api(`/agents/${id}`);
    assert.equal(afterUpdate.headers.get('x-cache'), 'MISS');
    assert.equal(afterUpdate.body.data.serviceArea, 'Jayanagar, Bengaluru');
  });

  it('invalidates the cached detail when an agent is deleted', async () => {
    const created = await api('/agents', { method: 'POST', body: validAgent() });
    const id = created.body.data.id;

    assert.equal((await api(`/agents/${id}`)).headers.get('x-cache'), 'MISS');
    await api(`/agents/${id}`, { method: 'DELETE' });

    assert.equal((await api(`/agents/${id}`)).status, 404);
  });

  it('keeps responses correct when values change between cached reads', async () => {
    const created = await api('/agents', { method: 'POST', body: validAgent() });
    const id = created.body.data.id;

    // Warm both caches.
    await api('/agents');
    await api(`/agents/${id}`);

    await api(`/agents/${id}`, { method: 'PATCH', body: { status: 'inactive' } });

    const list = await api('/agents?status=active');
    assert.equal(list.body.meta.total, 0);
    const detail = await api(`/agents/${id}`);
    assert.equal(detail.body.data.status, 'inactive');
  });
});
