# Dispatch — Delivery Agent Management System

A full-stack application for managing delivery agents: an **Express/Node.js REST API** backed by
**PostgreSQL** with **Redis** caching, an **admin login system with Redis-backed sessions**, and a
**React** single-page frontend.

![Admin sign-in](docs/screenshots/login.png)

![Agents list](docs/screenshots/agents-list.png)

---

## Contents

- [Overview](#overview)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Authentication](#authentication)
- [Database design](#database-design)
- [API reference](#api-reference)
- [Redis caching](#redis-caching)
- [Frontend](#frontend)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Configuration](#configuration)
- [Design trade-offs and next steps](#design-trade-offs-and-next-steps)

---

## Overview

An admin signs in with an email and password, then can:

1. **Create** a delivery agent (name, phone, email, service area, status).
2. **List** agents with pagination, full-text-ish search, status and service-area filters, sorting
   and dashboard counters.
3. **View** a single agent's full details.
4. **Update** an agent (partial `PATCH` or full `PUT`).
5. **Delete** an agent with a confirmation step.
6. **Sign out**, which revokes the server-side session.

All agent endpoints are protected: unauthenticated requests receive `401 AUTH_REQUIRED` and the
frontend redirects to `/login`. Every response uses a consistent JSON envelope, clear error codes
and field-level validation messages. Read endpoints are served through Redis and stay consistent
with writes.

| | |
|---|---|
| **Frontend** | http://127.0.0.1:5174 |
| **Login** | http://127.0.0.1:5174/login |
| **API** | http://127.0.0.1:4000/api/v1 |
| **Health** | http://127.0.0.1:4000/health |

Demo admin (seeded on first start): `admin@dispatch.local` / `Admin@12345`.

![Agent detail](docs/screenshots/agent-detail.png)

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js 20+ (tested on 24) | Required by the brief. |
| API framework | Express 5 | Minimal, familiar, native async error propagation. |
| Database | PostgreSQL 16 | Relational integrity, `CHECK` constraints, expression unique index, `timestamptz`, strong concurrency. |
| DB driver | `pg` (connection pool) | Mature, low overhead, parameterised SQL. |
| Cache | Redis | Required by the brief; used as a read-through cache. |
| Sessions | Redis (opaque tokens) | TTL-based server-side sessions, revocable on logout. |
| Password hashing | `scrypt` (`node:crypto`) | Memory-hard, built in, no native dependency. |
| Cache client | `ioredis` | The local Redis build is 3.0, which predates the RESP3 `HELLO` handshake that `node-redis` v4+ requires. `ioredis` speaks RESP2 and works with Redis 2.6+. |
| Frontend | React 19 + Vite 7 | Fast dev server, small build, no framework lock-in. |
| Routing | `react-router-dom` 7 | List and detail URLs (`/agents`, `/agents/:id`). |
| Styling | Hand-written CSS | Monochrome design system with blue/green/red accents; no UI dependency. |

No ORM: the data access layer is a small repository with parameterised SQL, which keeps the
query behaviour (index use, `ILIKE` escaping, pagination) explicit.

---

## Architecture

```
┌──────────────────────────┐        ┌──────────────────────────────────────────┐
│  React SPA (Vite :5174)  │        │  Express API (:4000)                     │
│                          │  HTTP  │                                          │
│  LoginPage               │ ─────► │  /auth/*  → session cookie ──► Redis     │
│  AgentsPage              │ cookie │                                          │
│  AgentDetailPage         │        │  /agents/* → requireAuth                 │
│  AgentFormModal          │        │        routes → validation → service     │
│  Toast / Modal / Table   │        │                     │            │       │
└──────────────────────────┘        │                     ▼            ▼       │
        Vite dev proxy forwards /api/* to 127.0.0.1:4000                  │
                                    │                Redis cache   PostgreSQL  │
                                    └──────────────────────────────────────────┘
```

Request flow for a protected read:

1. The browser sends the `dispatch.sid` HttpOnly cookie with the request.
2. `requireAuth` resolves the token in Redis and loads the admin from PostgreSQL.
3. Router validates the path/query (`parseListQuery`, `parseAgentId`).
4. Service reads the current cache version and builds a versioned key.
5. Cache hit → return immediately, set `X-Cache: HIT`.
6. Cache miss → repository queries PostgreSQL → result is written to Redis with a TTL →
   respond with `X-Cache: MISS`.
7. Writes bump the cache version and delete the affected agent entry.

---

## Getting started

### Prerequisites

- Node.js **20.11+** (24 recommended)
- PostgreSQL 14+ running and reachable
- Redis running (2.6+; only `GET`, `SET ... EX`, `INCR`, `DEL`, `MULTI` and `PING` are used)

### 1. Install dependencies

```bash
npm run setup
```

This installs `backend/` and `frontend/` dependencies.

### 2. Configure the environment

```bash
copy backend\.env.example backend\.env      # Windows
cp backend/.env.example backend/.env        # macOS/Linux
```

Set `DATABASE_URL` and `REDIS_URL`. The defaults in `backend/src/config.js` point at a local
PostgreSQL on `127.0.0.1:5432` and Redis on `127.0.0.1:6379`.

### 3. Create the databases

```bash
psql "postgres://USER:PASSWORD@127.0.0.1:5432/postgres" \
  -c "CREATE DATABASE delivery_agents;" \
  -c "CREATE DATABASE delivery_agents_test;"
```

The test database is only needed to run the test suite.

### 4. Apply the schema and demo data

```bash
npm run db:migrate
npm run db:seed
```

The API also applies the (idempotent) schema automatically on start-up, so `db:migrate` is optional
in normal use.

The first admin account is created automatically from `ADMIN_EMAIL` / `ADMIN_PASSWORD` when the
`admin_users` table is empty (and by `db:seed` as a fallback). The development defaults are
`admin@dispatch.local` / `Admin@12345` — change them before deploying.

### 5. Run both applications

```bash
npm run dev
```

This starts:

- **API** — http://127.0.0.1:4000/api/v1 (health at `/health`)
- **Web** — http://127.0.0.1:5174

Individual processes: `npm run dev:api`, `npm run dev:web`.

### Production build

```bash
npm run build     # frontend → frontend/dist
npm run start --prefix backend
```

Serve `frontend/dist` from any static host and proxy `/api` to the API, or set
`VITE_API_URL=http://api-host/api/v1` at build time.

---

## Authentication

Admin authentication is session-based and lives entirely on the server.

### Sign-in flow

1. `POST /api/v1/auth/login` with `{ email, password }`.
2. The API looks the admin up by email and verifies the password with **scrypt**
   (`scrypt$<salt>$<hash>`, constant-time comparison). Unknown emails still run a dummy hash so
   response timing does not reveal whether an account exists.
3. On success it generates a **256-bit random token**, stores only its SHA-256 in Redis
   (`dam:auth:session:<sha256>`, TTL 8 hours), and returns the token in an HttpOnly cookie.
4. The browser never sees the token in JavaScript. Every API request carries the cookie;
   `requireAuth` resolves the session, loads the admin and refreshes the TTL (sliding expiry).
5. `POST /api/v1/auth/logout` deletes the Redis key and expires the cookie. Because sessions are
   server-side, logout is immediate even if the cookie were copied.

Cookie attributes: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=28800`, and `Secure` when
`SESSION_COOKIE_SECURE=true` (default in production). `SameSite=Lax` plus JSON-only endpoints blocks
the classic cross-site form POST; a dedicated CSRF token would be the next hardening step.

### Security properties

| Concern | Handling |
|---|---|
| Password storage | scrypt with a random 16-byte salt per user |
| Session token storage | only the SHA-256 digest is stored in Redis |
| Session theft via XSS | token is in an HttpOnly cookie, never in `localStorage` |
| Brute force | 10 failed attempts per email+IP per 15 minutes → `429 TOO_MANY_ATTEMPTS` |
| Account enumeration | identical `401 INVALID_CREDENTIALS` message and hash timing |
| Session fixation | a fresh token is issued on every login |
| Stale sessions | 8-hour sliding TTL, revoked on logout, deleted if the admin row disappears |
| Redis outage | auth **fails closed** (`503 SESSION_UNAVAILABLE`); cache reads still fall back to PostgreSQL |

### Endpoints

| Method | Path | Purpose | Success |
|---|---|---|---|
| `POST` | `/auth/login` | Verify credentials, create session | `200` + `Set-Cookie` |
| `POST` | `/auth/logout` | Revoke session and clear cookie | `204` |
| `GET` | `/auth/me` | Current admin profile | `200` / `401` |

```bash
# Sign in and keep the cookie
curl -c cookies.txt -X POST http://127.0.0.1:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dispatch.local","password":"Admin@12345"}'

# Use the session
curl -b cookies.txt http://127.0.0.1:4000/api/v1/auth/me

# Sign out
curl -b cookies.txt -X POST http://127.0.0.1:4000/api/v1/auth/logout
```

### Admin accounts

`admin_users` supports a single `admin` role. To rotate the password, generate a hash and update the
row:

```bash
node --input-type=module -e "import('./backend/src/auth/password.js').then(m => console.log(m.hashPassword('new-strong-password')))"
```

```sql
UPDATE admin_users SET password_hash = '<hash>' WHERE email = 'admin@dispatch.local';
```

Changing `ADMIN_PASSWORD` only affects the **first** boot when no admin exists; it does not reset an
existing account.

---

## Database design

### Why PostgreSQL

- **Integrity where it matters.** Agent records are referenced by operational workflows; `NOT NULL`,
  `CHECK` length/status constraints and a case-insensitive unique email index keep invalid or
  duplicate data out of the store even if a second client bypasses the API.
- **Concurrency.** Row-level locking and MVCC handle simultaneous edits safely without application
  locking.
- **Correct time types.** `TIMESTAMPTZ` stores an absolute instant, so created/updated timestamps are
  unambiguous across time zones.
- **Query features used directly.** `ILIKE` search, `FILTER` aggregates for the dashboard counters,
  deterministic ordering and `LIMIT/OFFSET` pagination are all native.
- **Operational maturity.** Backups, point-in-time recovery and monitoring are well understood.

SQLite was the runner-up for a single-process demo, but it centralises writes and makes a
multi-instance deployment awkward; MongoDB would trade the useful relational constraints for schema
flexibility this domain does not need.

### Schema

```sql
CREATE TABLE agents (
  id           UUID PRIMARY KEY,                        -- generated by the API (crypto.randomUUID)
  full_name    TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  phone        TEXT NOT NULL CHECK (char_length(phone) BETWEEN 7 AND 32),
  email        TEXT NOT NULL CHECK (char_length(email) <= 254),
  service_area TEXT NOT NULL CHECK (char_length(service_area) BETWEEN 2 AND 120),
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX agents_email_unique_idx ON agents (lower(email));
CREATE INDEX agents_status_idx ON agents (status);
CREATE INDEX agents_service_area_idx ON agents (lower(service_area));
CREATE INDEX agents_created_at_idx ON agents (created_at DESC);

-- Admin accounts (login + audit trail of last sign-in)
CREATE TABLE admin_users (
  id            UUID PRIMARY KEY,
  full_name     TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  email         TEXT NOT NULL CHECK (char_length(email) <= 254),
  password_hash TEXT NOT NULL,          -- scrypt$<salt>$<hash>
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX admin_users_email_unique_idx ON admin_users (lower(email));
```

- **UUID primary keys** keep IDs non-sequential and safe to expose.
- **Case-insensitive unique email** via a unique index on `lower(email)` — `A@x.com` and `a@x.com`
  are the same agent; the repository maps PostgreSQL `23505` to HTTP `409`.
- **`updated_at` is maintained by a trigger** (`set_updated_at`), so it is correct for every writer,
  not just HTTP requests.
- **Indexes** match the list endpoint's filters (`status`, `lower(service_area)`) and default sort
  (`created_at DESC`). A trigram index would be the next step for large-scale `ILIKE` search.

All schema changes are idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`,
`DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`), applied by `backend/src/db/schema.js` on boot.

---

## API reference

Base URL: `http://127.0.0.1:4000/api/v1`

### Conventions

- JSON in, JSON out (`Content-Type: application/json`).
- Field names are **camelCase**; timestamps are **ISO-8601 UTC**.
- Successful single-resource responses: `{ "data": { ... } }`
- List responses: `{ "data": [ ... ], "meta": { ... } }`
- Errors: `{ "error": { "code", "message", "details?" }, "requestId" }`
- `X-Cache: HIT | MISS` is set on cached read endpoints.
- `X-Request-Id` is echoed (or generated) on every response and included in logs.
- `/agents/*` requires the `dispatch.sid` session cookie. Without it the API returns
  `401 AUTH_REQUIRED`; the SPA redirects to `/login`.

### Endpoints

| Method | Path | Auth | Purpose | Success | Cache |
|---|---|---|---|---|---|
| `POST` | `/auth/login` | public | Sign in, set session cookie | `200` | — |
| `POST` | `/auth/logout` | cookie | Revoke session | `204` | — |
| `GET` | `/auth/me` | cookie | Current admin profile | `200` | — |
| `GET` | `/agents` | required | List, search, filter, sort, paginate | `200` | ✅ versioned list key |
| `POST` | `/agents` | required | Create an agent | `201` + `Location` | invalidates |
| `GET` | `/agents/:id` | required | Fetch one agent | `200` | ✅ `agents:item:{id}` |
| `PUT` | `/agents/:id` | required | Replace mutable fields | `200` | invalidates |
| `PATCH` | `/agents/:id` | required | Partially update | `200` | invalidates |
| `DELETE` | `/agents/:id` | required | Delete | `204` | invalidates |
| `GET` | `/agents/stats` | required | Counters + distinct service areas | `200` | ✅ stats key |
| `GET` | `/agents/service-areas` | required | Distinct areas for filters | `200` | ✅ stats key |
| `GET` | `/health` | public | DB/Redis health | `200` / `503` | — |

### List query parameters

| Parameter | Type | Default | Rules |
|---|---|---|---|
| `page` | integer | `1` | ≥ 1 |
| `pageSize` | integer | `10` | 1–100 |
| `search` | string | — | ≤ 100 chars; matches name, email, phone or area (`ILIKE`, wildcards escaped) |
| `status` | enum | — | `active` or `inactive` |
| `serviceArea` | string | — | case-insensitive exact match |
| `sort` | enum | `createdAt` | `createdAt`, `updatedAt`, `fullName`, `status`, `serviceArea` |
| `order` | enum | `desc` | `asc`, `desc` |

`meta` contains `page`, `pageSize`, `total`, `totalPages`, `hasNextPage`, `hasPreviousPage`, `sort`,
`order`.

### Examples

**Create**

```bash
curl -X POST http://127.0.0.1:4000/api/v1/agents \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Neha Kapoor",
    "phone": "+91 98700 12345",
    "email": "neha.kapoor@example.com",
    "serviceArea": "Powai, Mumbai",
    "status": "active"
  }'
```

```json
HTTP/1.1 201 Created
Location: /api/v1/agents/5f0c1a9e-6d0f-4f5e-9a5b-4c3f2e1d0a9b

{
  "data": {
    "id": "5f0c1a9e-6d0f-4f5e-9a5b-4c3f2e1d0a9b",
    "fullName": "Neha Kapoor",
    "phone": "+91 98700 12345",
    "email": "neha.kapoor@example.com",
    "serviceArea": "Powai, Mumbai",
    "status": "active",
    "createdAt": "2026-11-02T05:10:00.000Z",
    "updatedAt": "2026-11-02T05:10:00.000Z"
  }
}
```

**List with filters**

```bash
curl "http://127.0.0.1:4000/api/v1/agents?page=1&pageSize=10&status=active&search=mumbai&sort=fullName&order=asc"
```

```json
{
  "data": [ { "id": "…", "fullName": "Aarav Sharma", "status": "active", "…": "…" } ],
  "meta": {
    "page": 1, "pageSize": 10, "total": 8, "totalPages": 1,
    "hasNextPage": false, "hasPreviousPage": false,
    "sort": "fullName", "order": "asc"
  }
}
```

**Partial update**

```bash
curl -X PATCH http://127.0.0.1:4000/api/v1/agents/5f0c…-… \
  -H "Content-Type: application/json" \
  -d '{ "status": "inactive" }'
```

**Delete**

```bash
curl -i -X DELETE http://127.0.0.1:4000/api/v1/agents/5f0c…-…
# HTTP/1.1 204 No Content
```

### Validation

The API validates before touching the database and returns **every** problem at once:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "email", "message": "Email address must be a valid email such as name@example.com" },
      { "field": "phone", "message": "Phone number must contain between 7 and 15 digits" }
    ]
  },
  "requestId": "0e3f…"
}
```

| Field | Rules |
|---|---|
| `fullName` | required, 2–120 chars, letters/spaces/`'`/`-`/`.` |
| `email` | required, valid address, ≤ 254 chars, lower-cased, unique (case-insensitive) |
| `phone` | required, 7–15 digits, allows `+`, spaces, `-`, `.`, `()` |
| `serviceArea` | required, 2–120 chars |
| `status` | `active` or `inactive` (defaults to `active` on create) |

`PATCH` requires at least one updatable field; unknown fields are ignored.

### Status codes

| Code | When |
|---|---|
| `200` | Read/update/sign-in succeeded |
| `201` | Agent created (`Location` header set) |
| `204` | Agent deleted or session ended |
| `400` | Invalid body, query parameters, UUID, or malformed JSON |
| `401` | `AUTH_REQUIRED` (no/expired session) or `INVALID_CREDENTIALS` |
| `404` | Agent or route not found |
| `409` | Email already belongs to another agent |
| `413` | Request body over 64 KB |
| `429` | Too many failed sign-in attempts |
| `503` | Database unavailable, or sessions unavailable (Redis down) |
| `500` | Unexpected error |

---

## Redis caching

### What is cached

| Key | Content | TTL |
|---|---|---|
| `dam:agents:version` | Integer cache generation | none |
| `dam:agents:v{n}:list:{sha1(query)}` | `{ items, total }` for one exact query | 60 s |
| `dam:agents:item:{id}` | `{ agent }` or `{ missing: true }` | 120 s (missing: 10 s) |
| `dam:agents:v{n}:stats` | Dashboard counters + distinct areas | 60 s |

`n` is the current value of the version key. The prefix (`dam`) and TTLs are configurable; the test
suite uses database `1` and prefix `dam:test`.

### Invalidation

Every write (`POST`, `PUT`, `PATCH`, `DELETE`) performs one `MULTI` transaction:

```
INCR dam:agents:version
DEL  dam:agents:item:<id>
```

- Incrementing the version makes **all** existing list and stats keys unreachable in **O(1)** —
  no `KEYS`/`SCAN`, no key-set bookkeeping, no risk of blocking Redis.
- Orphaned list keys are garbage-collected by their TTL (≤ 60 s).
- The agent's detail key is deleted explicitly, so an individual record is never stale.

This is a deliberate "versioned namespace" design: reads never need to track which queries exist,
and writes have a constant cost regardless of how many filter combinations were cached. The
trade-off is that old list entries linger until TTL; with 60-second TTLs the memory bound is small
and predictable.

### Consistency on create

A new agent *could* still be missing from a list cached a second earlier, so creation also bumps the
version — the next list request rebuilds from PostgreSQL. The test suite asserts this behaviour
(`X-Cache: MISS` after a write, and the new record present).

### Negative caching

`GET /agents/:id` for a missing id stores `{ missing: true }` for 10 seconds. This shields
PostgreSQL from repeated 404s (e.g., a detail page that was deleted) while keeping the window short.

### Stampede protection

The cache helper keeps an in-process `Map` of in-flight loads. When several identical requests miss
at once, only the first queries PostgreSQL; the rest await the same promise and then read from the
freshly written cache.

### Failure behaviour

Redis is treated as an optimisation, never a dependency:

- Connection or command failures are logged as warnings and reads fall back to PostgreSQL.
- If Redis is down during a write, the write still succeeds; the cache may serve stale reads until
  TTL expiry (documented limitation).
- `GET /health` reports `status: "degraded"` with `checks.redis: "down"` while the API keeps
  serving.

Inspect keys at any time:

```bash
redis-cli --scan --pattern 'dam:*'
redis-cli ttl "dam:agents:item:<id>"
```

---

## Frontend

- **Login page** — `/login` with email/password fields, inline required-field validation, a server
  error banner and (in development) the seeded demo credentials. After sign-in it returns you to the
  page you originally requested.
- **Session-aware shell** — the header shows the signed-in admin and a sign-out action; any `401`
  from the API clears local auth state and returns to `/login`.
- **Protected routes** — `/agents` and `/agents/:id` sit behind `ProtectedRoute`, with a splash while
  `/auth/me` resolves.
- **List view** — debounced search, status segmented filter, service-area and sort selects,
  pagination (10/25/50 per page), clickable overview cards, skeleton loaders, empty/error states.
- **Detail view** — `/agents/:id` with contact details, timestamps, copyable agent ID, edit/delete.
- **Create/edit modal** — shared form with required-field validation, server field errors mapped
  inline, status picker, keyboard support (`Esc` closes, focus moves into the dialog).
- **Delete confirmation** — destructive action is red and requires confirmation.
- **Toasts** — success/error feedback after sign-in and every mutation.
- **Cache indicator** — the `X-Cache` header is shown as a small chip so the Redis behaviour is
  visible while using the app.
- **Responsive** — the table becomes a card list below 720 px; stat cards reflow to a 2×2 grid.
- **Accessible** — labelled form controls, `aria-invalid`/`aria-describedby`, `aria-live` toasts,
  visible focus rings, keyboard-operable dialogs and pagination.

Design language: monochrome (black/white/grey) with blue reserved for links and selection, green for
active status and cache hits, red for destructive actions and errors.

![Create agent modal](docs/screenshots/create-agent.png)

---

## Testing

```bash
npm test
```

Runs 47 tests against a **real PostgreSQL database and a real Redis instance**:

- **`backend/test/agents.test.js`** — CRUD, validation errors, malformed JSON, duplicate email
  (`409`), pagination metadata, filtering/search, `PUT` vs `PATCH`, `404`s, stats/service areas, and
  cache behaviour (hit/miss, invalidation after create/update/delete). Signs in as a test admin
  first, because every agent route is protected.
- **`backend/test/auth.test.js`** — login success/failure, session cookie attributes, `/auth/me`,
  401s for missing/invalid sessions, logout revocation, and the login rate limiter.
- **`backend/test/validation.test.js`** — normalisation, field rules, query parsing, UUID parsing,
  and cache resilience when Redis commands throw.

The suite uses `delivery_agents_test` and Redis database `1` with prefix `dam:test`. It truncates the
agents table and clears only the `dam:test:agents:*` cache keys between tests, so the test admin's
session survives; it never touches development data.

---

## Project structure

```
.
├── backend
│   ├── src
│   │   ├── agents
│   │   │   ├── mapper.js        # DB row → API shape
│   │   │   ├── repository.js    # parameterised SQL
│   │   │   ├── routes.js        # HTTP layer
│   │   │   ├── service.js       # cache-aware business logic
│   │   │   └── validation.js    # payload/query validation
│   │   ├── auth
│   │   │   ├── adminRepository.js
│   │   │   ├── bootstrap.js     # creates the first admin
│   │   │   ├── cookies.js
│   │   │   ├── mapper.js
│   │   │   ├── middleware.js    # requireAuth
│   │   │   ├── password.js      # scrypt hash/verify
│   │   │   ├── routes.js        # login / logout / me
│   │   │   ├── service.js       # sessions + rate limiting
│   │   │   ├── sessionStore.js  # Redis-backed sessions
│   │   │   └── validation.js
│   │   ├── db
│   │   │   ├── migrate.js       # npm run db:migrate
│   │   │   ├── schema.js        # applies schema.sql
│   │   │   ├── schema.sql       # DDL
│   │   │   └── seed.js          # npm run db:seed
│   │   ├── middleware
│   │   │   ├── errorHandler.js
│   │   │   └── requestLogger.js
│   │   ├── app.js               # express app factory
│   │   ├── cache.js             # Redis read-through + versioned keys
│   │   ├── config.js
│   │   ├── database.js
│   │   ├── health.js
│   │   ├── logger.js
│   │   └── server.js            # bootstrap, migrations, graceful shutdown
│   └── test
├── frontend
│   ├── src
│   │   ├── api/client.js
│   │   ├── auth/AuthContext.jsx
│   │   ├── components            # incl. ProtectedRoute, Toast, Modal
│   │   ├── hooks
│   │   ├── pages                 # LoginPage, AgentsPage, AgentDetailPage
│   │   ├── utils
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   └── vite.config.js           # dev server + /api proxy
├── scripts/dev.mjs              # runs both apps with one command
├── docs/screenshots
└── package.json
```

---

## Configuration

All backend settings come from environment variables (`backend/.env`):

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | API port |
| `HOST` | `0.0.0.0` | Bind address |
| `DATABASE_URL` | `postgres://…@127.0.0.1:5432/delivery_agents` | PostgreSQL connection string |
| `DB_POOL_MAX` | `10` | Connection pool size |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Redis connection |
| `REDIS_DB` | `0` | Redis logical database |
| `REDIS_KEY_PREFIX` | `dam` | Key namespace |
| `REDIS_ENABLED` | `true` | Set `false` to bypass caching |
| `CACHE_LIST_TTL_SECONDS` | `60` | List cache TTL |
| `CACHE_DETAIL_TTL_SECONDS` | `120` | Detail cache TTL |
| `CACHE_STATS_TTL_SECONDS` | `60` | Stats cache TTL |
| `CACHE_NEGATIVE_TTL_SECONDS` | `10` | Missing-agent cache TTL |
| `CORS_ORIGIN` | `http://localhost:5174,http://127.0.0.1:5174` | Allowed browser origins (`*` for any) |
| `LOG_LEVEL` | `info` | `debug`/`info`/`warn`/`error` |
| `ADMIN_NAME` | `Operations Admin` | Display name for the first admin |
| `ADMIN_EMAIL` | `admin@dispatch.local` | Login email for the first admin |
| `ADMIN_PASSWORD` | `Admin@12345` | Used only when creating the first admin |
| `SESSION_TTL_SECONDS` | `28800` | Sliding session lifetime (8 h) |
| `SESSION_COOKIE_NAME` | `dispatch.sid` | Session cookie name |
| `SESSION_COOKIE_SECURE` | `false` (`true` in production) | Send the cookie over HTTPS only |

The frontend reads `VITE_API_URL` at build time (default `/api/v1`, proxied by Vite in dev).

---

## Design trade-offs and next steps

**Deliberate choices**

- **No ORM** — the SQL is small, explicit and easy to audit; an ORM would add indirection without
  simplifying anything at this size.
- **`OFFSET` pagination** — simple and adequate for this data volume; keyset pagination would be
  better for deep pages.
- **Versioned cache keys** — constant-cost invalidation over perfect reclamation; TTL handles
  cleanup.
- **Session cookies over JWT** — server-side sessions can be revoked immediately on logout and keep
  the token out of JavaScript entirely. The trade-off is that sign-in fails closed if Redis is down.
- **Single admin role** — sufficient for this brief; a role/permission model would be the next step
  if dispatchers and administrators need different access.

**Known limitations**

- Cache invalidation assumes a single cache namespace; multiple regions would each need their own
  version key or a pub/sub broadcast.
- Login rate limiting is per API process (in-memory), so a multi-instance deployment should move the
  counters into Redis.
- Search uses `ILIKE '%term%'`; for large tables a `pg_trgm` index (or PostgreSQL full-text search)
  is the natural upgrade.
- If Redis is unavailable during a write, stale reads can persist for up to the TTL.
- There is no self-service password reset or admin-management UI yet; accounts are managed in the
  database (see [Admin accounts](#admin-accounts)).

**Next steps**

- Role-based access control, an audit log of admin actions and optional two-factor authentication.
- Optimistic concurrency (`If-Match`/version column) for concurrent edits.
- Bulk import/export of agents, and assignment history.
- OpenAPI schema generated from the existing validation rules.
- Structured metrics (cache hit ratio, p95 latency) and OpenTelemetry traces.
