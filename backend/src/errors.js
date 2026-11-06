/**
 * Application error type carrying the HTTP status, a stable machine-readable
 * code and optional per-field details.
 */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    if (details) this.details = details;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message, details) {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  static validation(details, message = 'Request validation failed') {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(message, details) {
    return new ApiError(409, 'CONFLICT', message, details);
  }

  static serviceUnavailable(message = 'Service temporarily unavailable') {
    return new ApiError(503, 'SERVICE_UNAVAILABLE', message);
  }
}
