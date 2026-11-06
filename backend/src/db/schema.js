import { readFileSync } from 'node:fs';

const schemaSql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

/** Applies the idempotent DDL. Safe to run on every boot. */
export async function applySchema(db) {
  await db.query(schemaSql);
}
