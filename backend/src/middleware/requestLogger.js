import { randomUUID } from 'node:crypto';

/**
 * Assigns a request id, exposes it in the response and logs one line per
 * completed request with status code and duration.
 */
export function createRequestLogger(logger) {
  return (req, res, next) => {
    req.id = req.get('x-request-id') || randomUUID();
    res.setHeader('X-Request-Id', req.id);

    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      logger.info(`${req.method} ${req.originalUrl} -> ${res.statusCode}`, {
        requestId: req.id,
        durationMs: Number(durationMs.toFixed(1)),
      });
    });

    next();
  };
}
