export function createAdminRepository(db) {
  return {
    async findByEmail(email) {
      const { rows } = await db.query(
        'SELECT * FROM admin_users WHERE lower(email) = lower($1) LIMIT 1',
        [email],
      );
      return rows[0] ?? null;
    },

    async findById(id) {
      const { rows } = await db.query('SELECT * FROM admin_users WHERE id = $1 LIMIT 1', [id]);
      return rows[0] ?? null;
    },

    async create({ id, fullName, email, passwordHash }) {
      const { rows } = await db.query(
        `INSERT INTO admin_users (id, full_name, email, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [id, fullName, email.toLowerCase(), passwordHash],
      );
      return rows[0];
    },

    async updateLastLogin(id) {
      await db.query('UPDATE admin_users SET last_login_at = now() WHERE id = $1', [id]);
    },

    async count() {
      const { rows } = await db.query('SELECT count(*)::int AS total FROM admin_users');
      return rows[0].total;
    },
  };
}
