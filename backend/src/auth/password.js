import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const PREFIX = 'scrypt';

/**
 * Hashes a password with scrypt (memory-hard, built into Node).
 * Format: `scrypt$<salt-hex>$<derived-key-hex>` so the cost parameters can be
 * upgraded later without breaking existing hashes.
 */
export function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES).toString('hex');
  const derived = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `${PREFIX}$${salt}$${derived}`;
}

/** Constant-time verification of a password against a stored hash. */
export function verifyPassword(password, storedHash) {
  if (typeof storedHash !== 'string') return false;

  const [scheme, salt, hash] = storedHash.split('$');
  if (scheme !== PREFIX || !salt || !hash) return false;

  let expected;
  try {
    expected = Buffer.from(hash, 'hex');
  } catch {
    return false;
  }
  if (expected.length !== KEY_LENGTH) return false;

  const derived = scryptSync(password, salt, KEY_LENGTH);
  return timingSafeEqual(derived, expected);
}

// Used when the email is unknown so both branches spend the same hashing time,
// preventing account enumeration through response timing.
export const DUMMY_PASSWORD_HASH = hashPassword('invalid-password-placeholder');
