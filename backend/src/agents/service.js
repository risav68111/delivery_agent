import { createHash, randomUUID } from 'node:crypto';
import { ApiError } from '../errors.js';
import { toAgent } from './mapper.js';

const hashQuery = (query) =>
  createHash('sha1').update(JSON.stringify(query)).digest('hex').slice(0, 20);

/**
 * Business logic for agents. Owns cache keys, cache invalidation and the
 * mapping between HTTP-shaped input and database rows.
 */
export function createAgentService({ repository, cache, config, logger }) {
  const { listTtlSeconds, detailTtlSeconds, statsTtlSeconds, negativeTtlSeconds } = config.cache;

  async function listAgents(query) {
    const version = await cache.currentVersion();
    const key = cache.listKey(version, hashQuery(query));

    const { value, hit } = await cache.load(key, listTtlSeconds, async () => {
      const { rows, total } = await repository.list(query);
      return { value: { items: rows.map(toAgent), total } };
    });

    const totalPages = Math.max(1, Math.ceil(value.total / query.pageSize));
    return {
      items: value.items,
      cacheHit: hit,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: value.total,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1,
        sort: query.sort,
        order: query.order,
      },
    };
  }

  async function getAgent(id) {
    const key = cache.agentKey(id);
    const { value, hit } = await cache.load(key, detailTtlSeconds, async () => {
      const row = await repository.findById(id);
      if (!row) {
        // Short negative cache keeps repeated 404s off PostgreSQL.
        return { value: { missing: true }, ttlSeconds: negativeTtlSeconds };
      }
      return { value: { agent: toAgent(row) } };
    });

    if (value.missing) {
      throw ApiError.notFound(`Agent ${id} was not found`);
    }
    return { agent: value.agent, cacheHit: hit };
  }

  async function createAgent(input) {
    const row = await repository.create({ ...input, id: randomUUID() });
    await cache.invalidate([cache.agentKey(row.id)]);
    logger.info('Agent created', { agentId: row.id, email: row.email });
    return toAgent(row);
  }

  async function updateAgent(id, input) {
    const row = await repository.update(id, input);
    if (!row) {
      throw ApiError.notFound(`Agent ${id} was not found`);
    }
    await cache.invalidate([cache.agentKey(id)]);
    logger.info('Agent updated', { agentId: id, fields: Object.keys(input) });
    return toAgent(row);
  }

  async function deleteAgent(id) {
    const removed = await repository.remove(id);
    if (!removed) {
      throw ApiError.notFound(`Agent ${id} was not found`);
    }
    await cache.invalidate([cache.agentKey(id)]);
    logger.info('Agent deleted', { agentId: id });
  }

  async function getStats() {
    const version = await cache.currentVersion();
    const key = cache.statsKey(version);
    const { value, hit } = await cache.load(key, statsTtlSeconds, async () => ({
      value: await repository.stats(),
    }));
    return { stats: value, cacheHit: hit };
  }

  async function getServiceAreas() {
    const { stats, cacheHit } = await getStats();
    return { serviceAreas: stats.serviceAreas, cacheHit };
  }

  return {
    listAgents,
    getAgent,
    createAgent,
    updateAgent,
    deleteAgent,
    getStats,
    getServiceAreas,
  };
}
