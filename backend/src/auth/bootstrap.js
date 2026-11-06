import { randomUUID } from 'node:crypto';
import { hashPassword } from './password.js';

/**
 * Creates the first admin account from environment variables when the table is
 * empty, so a fresh installation always has a way in.
 */
export async function ensureAdminUser({ adminRepository, config, logger }) {
  const total = await adminRepository.count();
  if (total > 0) return;

  const { email, password, fullName } = config.admin;
  if (!email || !password) {
    logger.warn('No admin account exists and ADMIN_EMAIL/ADMIN_PASSWORD are not set');
    return;
  }

  const row = await adminRepository.create({
    id: randomUUID(),
    fullName,
    email,
    passwordHash: hashPassword(password),
  });

  logger.info('Created initial admin account', { email: row.email });
}
