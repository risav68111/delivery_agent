import { ApiError } from '../errors.js';

export const AGENT_STATUSES = Object.freeze(['active', 'inactive']);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s'.-]*$/u;
const AREA_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}\s,./&()'-]*$/u;
const PHONE_CHARACTERS = /^\+?[\d\s\-().]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const SORT_FIELDS = Object.freeze(['createdAt', 'updatedAt', 'fullName', 'status', 'serviceArea']);
const SORT_ORDERS = Object.freeze(['asc', 'desc']);

const collapse = (value) => value.replace(/\s+/g, ' ').trim();
const has = (body, key) => Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined;

function readText(body, field, options) {
  const { min, max, required, errors, label, transform = collapse, pattern, patternMessage } = options;

  if (!has(body, field)) {
    if (required) errors.push({ field, message: `${label} is required` });
    return undefined;
  }

  const raw = body[field];
  if (typeof raw !== 'string') {
    errors.push({ field, message: `${label} must be a string` });
    return undefined;
  }

  const value = transform(raw);
  if (!value) {
    errors.push({ field, message: `${label} must not be empty` });
    return undefined;
  }
  if (value.length < min || value.length > max) {
    errors.push({ field, message: `${label} must be between ${min} and ${max} characters` });
    return undefined;
  }
  if (pattern && !pattern.test(value)) {
    errors.push({ field, message: patternMessage });
    return undefined;
  }

  return value;
}

/**
 * Validates and normalises a create (full) or update (partial) payload.
 * Throws a 400 ApiError listing every field-level problem at once.
 */
export function parseAgentPayload(body, { partial = false } = {}) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw ApiError.badRequest('Request body must be a JSON object');
  }

  const errors = [];
  const input = {};

  const fullName = readText(body, 'fullName', {
    label: 'Full name',
    min: 2,
    max: 120,
    required: !partial,
    errors,
    pattern: NAME_PATTERN,
    patternMessage: 'Full name may only contain letters, spaces, hyphens, apostrophes and periods',
  });
  if (fullName !== undefined) input.fullName = fullName;

  const email = readText(body, 'email', {
    label: 'Email address',
    min: 5,
    max: 254,
    required: !partial,
    errors,
    transform: (value) => collapse(value).toLowerCase(),
    pattern: EMAIL_PATTERN,
    patternMessage: 'Email address must be a valid email such as name@example.com',
  });
  if (email !== undefined) input.email = email;

  if (has(body, 'phone')) {
    if (typeof body.phone !== 'string') {
      errors.push({ field: 'phone', message: 'Phone number must be a string' });
    } else {
      const value = collapse(body.phone);
      const digits = value.replace(/\D/g, '');
      if (!PHONE_CHARACTERS.test(value)) {
        errors.push({ field: 'phone', message: 'Phone number may only contain digits, spaces, +, -, . and parentheses' });
      } else if (digits.length < 7 || digits.length > 15) {
        errors.push({ field: 'phone', message: 'Phone number must contain between 7 and 15 digits' });
      } else {
        input.phone = value;
      }
    }
  } else if (!partial) {
    errors.push({ field: 'phone', message: 'Phone number is required' });
  }

  const serviceArea = readText(body, 'serviceArea', {
    label: 'Service area',
    min: 2,
    max: 120,
    required: !partial,
    errors,
    pattern: AREA_PATTERN,
    patternMessage: "Service area may only contain letters, digits, spaces and , . / & ( ) - '",
  });
  if (serviceArea !== undefined) input.serviceArea = serviceArea;

  if (has(body, 'status')) {
    if (typeof body.status !== 'string' || !AGENT_STATUSES.includes(body.status.trim().toLowerCase())) {
      errors.push({ field: 'status', message: `Status must be one of: ${AGENT_STATUSES.join(', ')}` });
    } else {
      input.status = body.status.trim().toLowerCase();
    }
  } else if (!partial) {
    input.status = 'active';
  }

  if (partial && Object.keys(input).length === 0 && errors.length === 0) {
    errors.push({ field: 'body', message: 'Provide at least one field to update' });
  }

  if (errors.length > 0) {
    throw ApiError.validation(errors);
  }

  return input;
}

/**
 * Parses and validates list query parameters (pagination, filtering, sorting).
 */
export function parseListQuery(query = {}) {
  const errors = [];
  const single = (value, field) => {
    if (Array.isArray(value)) {
      errors.push({ field, message: `${field} must be a single value` });
      return undefined;
    }
    return value;
  };

  const readInt = (field, fallback, min, max) => {
    const raw = single(query[field], field);
    if (raw === undefined || raw === '') return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) {
      errors.push({ field, message: `${field} must be an integer between ${min} and ${max}` });
      return fallback;
    }
    return value;
  };

  const page = readInt('page', 1, 1, 1_000_000);
  const pageSize = readInt('pageSize', 10, 1, 100);

  const readTextParam = (field, maxLength) => {
    const raw = single(query[field], field);
    if (raw === undefined) return undefined;
    if (typeof raw !== 'string') {
      errors.push({ field, message: `${field} must be a string` });
      return undefined;
    }
    const value = raw.trim();
    if (!value) return undefined;
    if (value.length > maxLength) {
      errors.push({ field, message: `${field} must be at most ${maxLength} characters` });
      return undefined;
    }
    return value;
  };

  const search = readTextParam('search', 100);
  const serviceArea = readTextParam('serviceArea', 120);

  const statusRaw = readTextParam('status', 20);
  let status;
  if (statusRaw !== undefined) {
    status = statusRaw.toLowerCase();
    if (!AGENT_STATUSES.includes(status)) {
      errors.push({ field: 'status', message: `status must be one of: ${AGENT_STATUSES.join(', ')}` });
      status = undefined;
    }
  }

  const sortRaw = readTextParam('sort', 20);
  let sort = 'createdAt';
  if (sortRaw !== undefined) {
    if (!SORT_FIELDS.includes(sortRaw)) {
      errors.push({ field: 'sort', message: `sort must be one of: ${SORT_FIELDS.join(', ')}` });
    } else {
      sort = sortRaw;
    }
  }

  const orderRaw = readTextParam('order', 4);
  let order = 'desc';
  if (orderRaw !== undefined) {
    const normalized = orderRaw.toLowerCase();
    if (!SORT_ORDERS.includes(normalized)) {
      errors.push({ field: 'order', message: 'order must be asc or desc' });
    } else {
      order = normalized;
    }
  }

  if (errors.length > 0) {
    throw ApiError.validation(errors);
  }

  return { page, pageSize, search, serviceArea, status, sort, order };
}

export function parseAgentId(value) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw ApiError.badRequest('Agent id must be a valid UUID', [
      { field: 'id', message: 'id must be a valid UUID' },
    ]);
  }
  return value.toLowerCase();
}
