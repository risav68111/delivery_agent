import { ApiError } from '../errors.js';
import { toAdmin } from './mapper.js';
import { DUMMY_PASSWORD_HASH, verifyPassword } from './password.js';

const MAX_ATTEMPTS = 10;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Admin authentication: credential verification, rate limiting, session
 * creation and per-request session resolution.
 */
export function createAuthService({ adminRepository, sessions, logger }) {
  const failures = new Map();

  function prune(now) {
    if (failures.size < 500) return;
    for (const [key, entry] of failures) {
      if (entry.resetAt <= now) failures.delete(key);
    }
  }

  function assertNotLocked(key) {
    const now = Date.now();
    prune(now);

    const entry = failures.get(key);
    if (!entry || entry.resetAt <= now) {
      failures.set(key, { count: 0, resetAt: now + ATTEMPT_WINDOW_MS });
      return;
    }
    if (entry.count >= MAX_ATTEMPTS) {
      throw new ApiError(
        429,
        'TOO_MANY_ATTEMPTS',
        'Too many sign-in attempts. Please try again in a few minutes.',
      );
    }
  }

  function recordFailure(key) {
    const entry = failures.get(key);
    if (entry) entry.count += 1;
  }

  async function login({ email, password, ip }) {
    const key = `${ip ?? 'unknown'}|${email}`;
    assertNotLocked(key);

    const row = await adminRepository.findByEmail(email);
    // Always run a hash comparison so unknown emails take the same time.
    const valid = verifyPassword(password, row?.password_hash ?? DUMMY_PASSWORD_HASH);

    if (!row || !valid) {
      recordFailure(key);
      logger.warn('Failed sign-in attempt', { email, ip });
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
    }

    failures.delete(key);

    let token;
    try {
      token = await sessions.create(row.id);
    } catch (error) {
      logger.error('Could not create session', { error: error.message });
      throw new ApiError(
        503,
        'SESSION_UNAVAILABLE',
        'Sign-in is temporarily unavailable. Please retry in a moment.',
      );
    }

    await adminRepository.updateLastLogin(row.id).catch((error) => {
      logger.warn('Could not record last login', { error: error.message });
    });

    logger.info('Admin signed in', { adminId: row.id, email: row.email });
    return { token, admin: toAdmin({ ...row, last_login_at: new Date() }) };
  }

  async function authenticate(token) {
    if (!token) {
      throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required.');
    }

    let session;
    try {
      session = await sessions.get(token);
    } catch (error) {
      logger.error('Session lookup failed', { error: error.message });
      throw new ApiError(
        503,
        'SESSION_UNAVAILABLE',
        'Sign-in is temporarily unavailable. Please retry in a moment.',
      );
    }

    if (!session) {
      throw new ApiError(401, 'AUTH_REQUIRED', 'Your session has expired. Please sign in again.');
    }

    const row = await adminRepository.findById(session.adminId);
    if (!row) {
      await sessions.destroy(token);
      throw new ApiError(401, 'AUTH_REQUIRED', 'Your session is no longer valid. Please sign in again.');
    }

    void sessions.touch(token);
    return { admin: toAdmin(row), token };
  }

  async function logout(token) {
    await sessions.destroy(token);
  }

  return { login, authenticate, logout };
}
