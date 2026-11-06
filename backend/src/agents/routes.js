import express from 'express';
import { parseAgentId, parseAgentPayload, parseListQuery } from './validation.js';

function exposeCacheStatus(res, cacheHit) {
  res.set('X-Cache', cacheHit ? 'HIT' : 'MISS');
  res.set('Cache-Control', 'no-store');
}

export function createAgentsRouter({ service }) {
  const router = express.Router();

  // GET /api/v1/agents — paginated, searchable, filterable list
  router.get('/', async (req, res) => {
    const query = parseListQuery(req.query);
    const result = await service.listAgents(query);

    exposeCacheStatus(res, result.cacheHit);
    res.json({ data: result.items, meta: result.meta });
  });

  // GET /api/v1/agents/stats — dashboard counters (declared before /:id)
  router.get('/stats', async (_req, res) => {
    const { stats, cacheHit } = await service.getStats();
    exposeCacheStatus(res, cacheHit);
    res.json({ data: stats });
  });

  // GET /api/v1/agents/service-areas — distinct areas for filter dropdowns
  router.get('/service-areas', async (_req, res) => {
    const { serviceAreas, cacheHit } = await service.getServiceAreas();
    exposeCacheStatus(res, cacheHit);
    res.json({ data: serviceAreas });
  });

  // GET /api/v1/agents/:id
  router.get('/:id', async (req, res) => {
    const id = parseAgentId(req.params.id);
    const { agent, cacheHit } = await service.getAgent(id);

    exposeCacheStatus(res, cacheHit);
    res.json({ data: agent });
  });

  // POST /api/v1/agents
  router.post('/', async (req, res) => {
    const input = parseAgentPayload(req.body);
    const agent = await service.createAgent(input);

    res
      .status(201)
      .location(`${req.baseUrl}/${agent.id}`)
      .json({ data: agent });
  });

  // PUT /api/v1/agents/:id — full replacement of the mutable fields
  router.put('/:id', async (req, res) => {
    const id = parseAgentId(req.params.id);
    const input = parseAgentPayload(req.body);

    const agent = await service.updateAgent(id, input);
    res.json({ data: agent });
  });

  // PATCH /api/v1/agents/:id — partial update
  router.patch('/:id', async (req, res) => {
    const id = parseAgentId(req.params.id);
    const input = parseAgentPayload(req.body, { partial: true });

    const agent = await service.updateAgent(id, input);
    res.json({ data: agent });
  });

  // DELETE /api/v1/agents/:id
  router.delete('/:id', async (req, res) => {
    const id = parseAgentId(req.params.id);
    await service.deleteAgent(id);
    res.status(204).end();
  });

  return router;
}
