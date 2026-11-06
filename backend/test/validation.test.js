import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { RedisCache } from '../src/cache.js';
import { ApiError } from '../src/errors.js';
import { parseAgentId, parseAgentPayload, parseListQuery } from '../src/agents/validation.js';

describe('parseAgentPayload', () => {
  it('normalises whitespace, casing and defaults', () => {
    const input = parseAgentPayload({
      fullName: '  Ravi   Kumar ',
      email: ' Ravi.Kumar@Example.COM ',
      phone: '+91 98765 43210',
      serviceArea: ' Salt   Lake, Kolkata ',
    });

    assert.deepEqual(input, {
      fullName: 'Ravi Kumar',
      email: 'ravi.kumar@example.com',
      phone: '+91 98765 43210',
      serviceArea: 'Salt Lake, Kolkata',
      status: 'active',
    });
  });

  it('rejects invalid phone numbers and emails', () => {
    assert.throws(
      () => parseAgentPayload({ fullName: 'A B', email: 'bad', phone: '123', serviceArea: 'Zone 1' }),
      (error) => error instanceof ApiError && error.code === 'VALIDATION_ERROR',
    );
  });

  it('requires every field for a full payload', () => {
    assert.throws(
      () => parseAgentPayload({ fullName: 'Only Name' }),
      (error) => error.status === 400 && error.details.length >= 3,
    );
  });

  it('accepts a single field for a partial payload', () => {
    assert.deepEqual(parseAgentPayload({ status: 'inactive' }, { partial: true }), {
      status: 'inactive',
    });
  });

  it('rejects an empty partial payload', () => {
    assert.throws(() => parseAgentPayload({}, { partial: true }), ApiError);
  });

  it('rejects non-object bodies', () => {
    assert.throws(() => parseAgentPayload('hello'), ApiError);
    assert.throws(() => parseAgentPayload(['x']), ApiError);
  });
});

describe('parseListQuery', () => {
  it('applies defaults', () => {
    assert.deepEqual(parseListQuery({}), {
      page: 1,
      pageSize: 10,
      search: undefined,
      serviceArea: undefined,
      status: undefined,
      sort: 'createdAt',
      order: 'desc',
    });
  });

  it('coerces valid values', () => {
    const query = parseListQuery({ page: '3', pageSize: '25', status: 'ACTIVE', sort: 'fullName', order: 'asc' });
    assert.equal(query.page, 3);
    assert.equal(query.pageSize, 25);
    assert.equal(query.status, 'active');
    assert.equal(query.sort, 'fullName');
    assert.equal(query.order, 'asc');
  });

  it('rejects out-of-range and unknown values', () => {
    assert.throws(() => parseListQuery({ pageSize: 0 }), ApiError);
    assert.throws(() => parseListQuery({ sort: 'password' }), ApiError);
    assert.throws(() => parseListQuery({ status: 'paused' }), ApiError);
  });
});

describe('parseAgentId', () => {
  it('accepts and lowercases a UUID', () => {
    assert.equal(
      parseAgentId('7B0F3F4A-1C2D-4E5F-8A9B-0C1D2E3F4A5B'),
      '7b0f3f4a-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
    );
  });

  it('rejects non-UUID values', () => {
    assert.throws(() => parseAgentId('42'), ApiError);
  });
});

describe('RedisCache resilience', () => {
  const silentLogger = { debug() {}, info() {}, warn() {}, error() {} };

  function failingCache() {
    const client = {
      status: 'ready',
      get: async () => {
        throw new Error('connection lost');
      },
      set: async () => {
        throw new Error('connection lost');
      },
      multi: () => {
        throw new Error('connection lost');
      },
      ping: async () => {
        throw new Error('connection lost');
      },
    };
    return new RedisCache({
      client,
      keyPrefix: 'test',
      cache: { listTtlSeconds: 60, detailTtlSeconds: 60, statsTtlSeconds: 60, negativeTtlSeconds: 5 },
      logger: silentLogger,
    });
  }

  it('falls back to the loader when Redis commands fail', async () => {
    const cache = failingCache();
    const { value, hit } = await cache.load('key', 60, async () => ({ value: { ok: true } }));

    assert.deepEqual(value, { ok: true });
    assert.equal(hit, false);
  });

  it('reports version 0 and an unhealthy ping when Redis fails', async () => {
    const cache = failingCache();
    assert.equal(await cache.currentVersion(), 0);
    assert.equal(await cache.ping(), false);
  });

  it('swallows invalidation failures', async () => {
    const cache = failingCache();
    await assert.doesNotReject(cache.invalidate(['some:key']));
  });
});
