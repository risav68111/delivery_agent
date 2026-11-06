const API_BASE = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR', details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Maps server field details to `{ fieldName: message }` for form rendering. */
  get fieldErrors() {
    const errors = {};
    for (const detail of this.details ?? []) {
      if (detail?.field) errors[detail.field] = detail.message;
    }
    return errors;
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      signal,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(
      'Could not reach the API. Make sure the backend is running on http://127.0.0.1:4000.',
      { code: 'NETWORK_ERROR' },
    );
  }

  if (response.status === 204) {
    return { data: null, meta: null, cache: response.headers.get('X-Cache') };
  }

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const error = payload?.error;
    if (response.status === 401 && error?.code === 'AUTH_REQUIRED') {
      // Let the auth provider clear its state and redirect to the login page.
      window.dispatchEvent(new Event('dispatch:unauthorized'));
    }
    throw new ApiError(error?.message ?? `Request failed with status ${response.status}`, {
      status: response.status,
      code: error?.code ?? 'HTTP_ERROR',
      details: error?.details ?? null,
    });
  }

  return {
    data: payload?.data ?? null,
    meta: payload?.meta ?? null,
    cache: response.headers.get('X-Cache'),
  };
}

export function listAgents(params = {}, { signal } = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  }
  return request(`/agents?${query.toString()}`, { signal });
}

export function getAgent(id, { signal } = {}) {
  return request(`/agents/${encodeURIComponent(id)}`, { signal });
}

export function createAgent(input) {
  return request('/agents', { method: 'POST', body: input });
}

export function updateAgent(id, input) {
  return request(`/agents/${encodeURIComponent(id)}`, { method: 'PATCH', body: input });
}

export function deleteAgent(id) {
  return request(`/agents/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function getStats({ signal } = {}) {
  return request('/agents/stats', { signal });
}

/* -------------------------------------------------------------------------- */
/* Authentication                                                             */
/* -------------------------------------------------------------------------- */

export function login(credentials) {
  return request('/auth/login', { method: 'POST', body: credentials });
}

export function logout() {
  return request('/auth/logout', { method: 'POST' });
}

export function getMe({ signal } = {}) {
  return request('/auth/me', { signal });
}
