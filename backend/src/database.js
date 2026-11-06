import pg from 'pg';

/**
 * Thin wrapper around a PostgreSQL connection pool.
 * The pool is created once per process and shared by every repository.
 */
export function createDatabase(options, logger) {
  const pool = new pg.Pool({
    connectionString: options.connectionString,
    max: options.max,
    connectionTimeoutMillis: options.connectionTimeoutMillis,
    idleTimeoutMillis: options.idleTimeoutMillis,
    application_name: 'delivery-agent-api',
    ...(options.ssl ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  pool.on('error', (error) => {
    logger.error('Unexpected PostgreSQL pool error', { error: error.message });
  });

  return {
    pool,
    query: (text, params) => pool.query(text, params),
    async ping() {
      await pool.query('SELECT 1');
    },
    async close() {
      await pool.end();
    },
  };
}
