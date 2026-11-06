import { ApiError } from '../errors.js';

export function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} was not found`));
}

/**
 * Converts thrown errors into the API's single error envelope:
 * { error: { code, message, details? }, requestId }
 */
export function createErrorHandler(logger) {
  return (error, req, res, next) => {
    if (res.headersSent) return next(error);

    const requestId = req.id;

    if (error instanceof ApiError) {
      if (error.status >= 500) {
        logger.error('Request failed', { requestId, code: error.code, error: error.message });
      } else {
        logger.warn('Request rejected', { requestId, code: error.code, error: error.message });
      }
      const payload = { error: { code: error.code, message: error.message } };
      if (error.details) payload.error.details = error.details;
      return res.status(error.status).json({ ...payload, requestId });
    }

    if (error?.type === 'entity.parse.failed') {
      return res.status(400).json({
        error: { code: 'INVALID_JSON', message: 'Request body contains malformed JSON' },
        requestId,
      });
    }

    if (error?.type === 'entity.too.large') {
      return res.status(413).json({
        error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' },
        requestId,
      });
    }

    if (['ECONNREFUSED', '57P01', '08001', '08006'].includes(error?.code)) {
      logger.error('Database unavailable', { requestId, code: error.code });
      return res.status(503).json({
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'The database is unavailable. Please retry in a moment.',
        },
        requestId,
      });
    }

    logger.error('Unhandled error', { requestId, error: error?.stack ?? String(error) });
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      requestId,
    });
  };
}
