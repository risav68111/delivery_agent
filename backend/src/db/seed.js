import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { createLogger } from '../logger.js';
import { createDatabase } from '../database.js';
import { applySchema } from './schema.js';
import { createAdminRepository } from '../auth/adminRepository.js';
import { hashPassword } from '../auth/password.js';

const logger = createLogger({ level: 'info' });
const db = createDatabase(config.db, logger);

const AGENTS = [
  ['00000000-0000-4000-8000-000000000001', 'Aarav Sharma', '+91 98200 11223', 'aarav.sharma@example.com', 'Andheri East, Mumbai', 'active', 42],
  ['00000000-0000-4000-8000-000000000002', 'Priya Nair', '+91 90045 33221', 'priya.nair@example.com', 'Koramangala, Bengaluru', 'active', 38],
  ['00000000-0000-4000-8000-000000000003', 'Rohan Mehta', '+91 99870 44112', 'rohan.mehta@example.com', 'Salt Lake, Kolkata', 'inactive', 35],
  ['00000000-0000-4000-8000-000000000004', 'Sneha Iyer', '+91 98450 66554', 'sneha.iyer@example.com', 'HSR Layout, Bengaluru', 'active', 31],
  ['00000000-0000-4000-8000-000000000005', 'Vikram Singh', '+91 98110 22334', 'vikram.singh@example.com', 'Connaught Place, Delhi', 'active', 27],
  ['00000000-0000-4000-8000-000000000006', 'Ananya Das', '+91 98300 77889', 'ananya.das@example.com', 'Park Street, Kolkata', 'inactive', 24],
  ['00000000-0000-4000-8000-000000000007', 'Karthik Reddy', '+91 90000 44556', 'karthik.reddy@example.com', 'Banjara Hills, Hyderabad', 'active', 19],
  ['00000000-0000-4000-8000-000000000008', 'Meera Joshi', '+91 97650 88997', 'meera.joshi@example.com', 'Kothrud, Pune', 'active', 15],
  ['00000000-0000-4000-8000-000000000009', 'Arjun Patel', '+91 97250 33445', 'arjun.patel@example.com', 'Navrangpura, Ahmedabad', 'inactive', 11],
  ['00000000-0000-4000-8000-000000000010', 'Divya Menon', '+91 98950 66778', 'divya.menon@example.com', 'Marine Drive, Kochi', 'active', 8],
  ['00000000-0000-4000-8000-000000000011', 'Farhan Khan', '+91 99200 55667', 'farhan.khan@example.com', 'Bandra West, Mumbai', 'active', 4],
  ['00000000-0000-4000-8000-000000000012', 'Ishita Bose', '+91 98310 99001', 'ishita.bose@example.com', 'New Town, Kolkata', 'inactive', 1],
];

try {
  await applySchema(db);

  let inserted = 0;
  for (const [id, fullName, phone, email, serviceArea, status, daysAgo] of AGENTS) {
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const result = await db.query(
      `INSERT INTO agents (id, full_name, phone, email, service_area, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       ON CONFLICT (id) DO NOTHING`,
      [id, fullName, phone, email, serviceArea, status, createdAt],
    );
    inserted += result.rowCount;
  }

  const { rows } = await db.query('SELECT count(*)::int AS total FROM agents');
  logger.info('Seed complete', { inserted, totalInDatabase: rows[0].total });

  const adminRepository = createAdminRepository(db);
  const adminCount = await adminRepository.count();
  if (adminCount === 0) {
    await adminRepository.create({
      id: randomUUID(),
      fullName: config.admin.fullName,
      email: config.admin.email,
      passwordHash: hashPassword(config.admin.password),
    });
    logger.info('Admin account created', { email: config.admin.email });
  } else {
    logger.info('Admin account already exists', { count: adminCount });
  }
} catch (error) {
  logger.error('Seeding failed', { error: error.message });
  process.exitCode = 1;
} finally {
  await db.close();
}
