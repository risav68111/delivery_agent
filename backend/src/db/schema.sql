-- Delivery Agent Management System — PostgreSQL schema
-- Applied automatically on API start-up and by `npm run db:migrate`.

CREATE TABLE IF NOT EXISTS agents (
  id           UUID PRIMARY KEY,
  full_name    TEXT        NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  phone        TEXT        NOT NULL CHECK (char_length(phone) BETWEEN 7 AND 32),
  email        TEXT        NOT NULL CHECK (char_length(email) <= 254),
  service_area TEXT        NOT NULL CHECK (char_length(service_area) BETWEEN 2 AND 120),
  status       TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Emails are unique regardless of casing.
CREATE UNIQUE INDEX IF NOT EXISTS agents_email_unique_idx ON agents (lower(email));

CREATE INDEX IF NOT EXISTS agents_status_idx ON agents (status);
CREATE INDEX IF NOT EXISTS agents_service_area_idx ON agents (lower(service_area));
CREATE INDEX IF NOT EXISTS agents_created_at_idx ON agents (created_at DESC);

-- Keep updated_at authoritative in the database, not in application code.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agents_set_updated_at ON agents;
CREATE TRIGGER agents_set_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Admin accounts allowed to manage the agent directory.
CREATE TABLE IF NOT EXISTS admin_users (
  id            UUID PRIMARY KEY,
  full_name     TEXT        NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  email         TEXT        NOT NULL CHECK (char_length(email) <= 254),
  password_hash TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_unique_idx ON admin_users (lower(email));
