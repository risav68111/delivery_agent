import { config } from '../config.js';
import { createLogger } from '../logger.js';
import { createDatabase } from '../database.js';
import { applySchema } from './schema.js';

const logger = createLogger({ level: 'info' });
const db = createDatabase(config.db, logger);

try {
  await applySchema(db);
  logger.info('Database schema applied', {
    database: config.db.connectionString.replace(/:\/\/([^:]+):[^@]*@/, '://$1:***@'),
  });
} catch (error) {
  logger.error('Schema migration failed', { error: error.message });
  process.exitCode = 1;
} finally {
  await db.close();
}
