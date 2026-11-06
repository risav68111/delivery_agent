import { ApiError } from '../errors.js';

const SORT_COLUMNS = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  fullName: 'full_name',
  status: 'status',
  serviceArea: 'service_area',
};

const COLUMN_BY_FIELD = {
  fullName: 'full_name',
  phone: 'phone',
  email: 'email',
  serviceArea: 'service_area',
  status: 'status',
};

/** Escapes LIKE wildcards so user input is matched literally. */
const escapeLike = (value) => value.replace(/[\\%_]/g, (match) => `\\${match}`);

function translateDatabaseError(error) {
  if (error?.code === '23505' && error.constraint === 'agents_email_unique_idx') {
    return ApiError.conflict('An agent with this email address already exists', [
      { field: 'email', message: 'This email address is already registered to another agent' },
    ]);
  }
  if (error?.code === '23514') {
    return ApiError.badRequest('One or more fields violate database constraints');
  }
  return error;
}

export function createAgentRepository(db) {
  return {
    async list({ page, pageSize, search, status, serviceArea, sort, order }) {
      const conditions = [];
      const params = [];

      if (search) {
        params.push(`%${escapeLike(search)}%`);
        const placeholder = `$${params.length}`;
        conditions.push(
          `(full_name ILIKE ${placeholder} ESCAPE '\\'
            OR email ILIKE ${placeholder} ESCAPE '\\'
            OR phone ILIKE ${placeholder} ESCAPE '\\'
            OR service_area ILIKE ${placeholder} ESCAPE '\\')`,
        );
      }
      if (status) {
        params.push(status);
        conditions.push(`status = $${params.length}`);
      }
      if (serviceArea) {
        params.push(serviceArea.toLowerCase());
        conditions.push(`lower(service_area) = $${params.length}`);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const sortColumn = SORT_COLUMNS[sort] ?? 'created_at';
      const direction = order === 'asc' ? 'ASC' : 'DESC';
      const offset = (page - 1) * pageSize;

      const countSql = `SELECT count(*)::int AS total FROM agents ${where}`;
      const rowsSql = `
        SELECT * FROM agents
        ${where}
        ORDER BY ${sortColumn} ${direction}, id ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const [countResult, rowsResult] = await Promise.all([
        db.query(countSql, params),
        db.query(rowsSql, [...params, pageSize, offset]),
      ]);

      return { total: countResult.rows[0].total, rows: rowsResult.rows };
    },

    async findById(id) {
      const { rows } = await db.query('SELECT * FROM agents WHERE id = $1', [id]);
      return rows[0] ?? null;
    },

    async create(input) {
      try {
        const { rows } = await db.query(
          `INSERT INTO agents (id, full_name, phone, email, service_area, status)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [input.id, input.fullName, input.phone, input.email, input.serviceArea, input.status],
        );
        return rows[0];
      } catch (error) {
        throw translateDatabaseError(error);
      }
    },

    async update(id, fields) {
      const assignments = [];
      const params = [];

      for (const [field, column] of Object.entries(COLUMN_BY_FIELD)) {
        if (fields[field] !== undefined) {
          params.push(fields[field]);
          assignments.push(`${column} = $${params.length}`);
        }
      }

      if (assignments.length === 0) {
        return this.findById(id);
      }

      params.push(id);
      try {
        const { rows } = await db.query(
          `UPDATE agents SET ${assignments.join(', ')} WHERE id = $${params.length} RETURNING *`,
          params,
        );
        return rows[0] ?? null;
      } catch (error) {
        throw translateDatabaseError(error);
      }
    },

    async remove(id) {
      const { rowCount } = await db.query('DELETE FROM agents WHERE id = $1', [id]);
      return rowCount > 0;
    },

    async stats() {
      const [counts, areas] = await Promise.all([
        db.query(
          `SELECT count(*)::int AS total,
                  count(*) FILTER (WHERE status = 'active')::int AS active,
                  count(*) FILTER (WHERE status = 'inactive')::int AS inactive
           FROM agents`,
        ),
        db.query('SELECT DISTINCT service_area FROM agents ORDER BY service_area ASC'),
      ]);

      return {
        total: counts.rows[0].total,
        active: counts.rows[0].active,
        inactive: counts.rows[0].inactive,
        serviceAreas: areas.rows.map((row) => row.service_area),
        generatedAt: new Date().toISOString(),
      };
    },
  };
}
