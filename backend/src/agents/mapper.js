/**
 * Maps a PostgreSQL row (snake_case, Date objects) to the public API shape
 * (camelCase, ISO-8601 timestamps).
 */
export function toAgent(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    serviceArea: row.service_area,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
