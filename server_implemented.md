# Server — Implemented

Stack: **Node.js · Express · TypeScript · Drizzle ORM · postgres.js · PostgreSQL · JWT · bcryptjs · Zod**

---

## Project Setup

| File | What it does |
|------|-------------|
| `package.json` | deps + scripts: `dev`, `build`, `start`, `db:generate`, `db:migrate`, `db:studio` |
| `tsconfig.json` | strict TS, ES2022, CommonJS output to `dist/` |
| `.env` / `.env.example` | `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT` |
| `.gitignore` | ignores `node_modules/`, `dist/`, `.env`, `drizzle/meta/` |
| `drizzle.config.ts` | drizzle-kit CLI — schema: `src/db/schema/index.ts`, out: `drizzle/` |

---

## Database Schema

### Schema folder structure

```
src/db/schema/
  index.ts                            ← barrel re-export of everything below
  auth/
    users.ts                          ← users table + userRoleEnum
    users.relations.ts                ← users → many subCompanyUsers
  companies/
    sub-companies.ts                  ← sub_companies table
    sub-companies.relations.ts        ← subCompanies → many subCompanyUsers
    sub-company-users.ts              ← sub_company_users join table
    sub-company-users.relations.ts    ← subCompanyUsers → one user, one subCompany
```

### `users` table (`src/db/schema/auth/users.ts`)

| Column | DB type | Constraints |
|--------|---------|-------------|
| `id` | uuid | PK, defaultRandom |
| `name` | varchar(255) | not null |
| `email` | varchar(255) | not null, unique |
| `phone_number` | varchar(20) | not null, unique |
| `password` | varchar(255) | not null (bcrypt hash) |
| `role` | enum `user_role` | `owner` / `admin` / `floor_manager` / `member`, default `member` |
| `is_active` | boolean | not null, default `true` |
| `created_at` | timestamp | defaultNow |
| `updated_at` | timestamp | defaultNow |

### `sub_companies` table (`src/db/schema/companies/sub-companies.ts`)

| Column | DB type | Constraints |
|--------|---------|-------------|
| `id` | uuid | PK, defaultRandom |
| `name` | varchar(255) | not null |
| `address` | text | nullable |
| `city` | varchar(100) | nullable |
| `phone` | varchar(20) | nullable |
| `created_at` | timestamp | defaultNow |
| `updated_at` | timestamp | defaultNow |

### `sub_company_users` table (`src/db/schema/companies/sub-company-users.ts`)

| Column | DB type | Constraints |
|--------|---------|-------------|
| `user_id` | uuid | FK → `users.id` ON DELETE CASCADE |
| `sub_company_id` | uuid | FK → `sub_companies.id` ON DELETE CASCADE |
| `is_primary` | boolean | not null, default `false` |
| `created_at` | timestamp | defaultNow |

Composite PK: `(user_id, sub_company_id)`

---

## Infrastructure

| File | What it does |
|------|-------------|
| `src/db/connection.ts` | Exports singleton `db` (drizzle wrapping a postgres.js client) |
| `src/lib/jwt.ts` | `signToken(payload)` / `verifyToken(token)` — payload shape: `{ sub, role, subCompanyIds }` |
| `src/middleware/auth.ts` | `requireAuth` — validates Bearer JWT; `requireRole(...roles)` — 403 if role not in list |
| `src/index.ts` | Express entry — JSON body parser, `/health`, mounts `/api/auth` |

---

## Routes

### `GET /health`
Returns `{ status: "ok" }`. No auth required.

### `POST /api/auth/login`
File: `src/routes/auth.ts`

**Request body**
```json
{ "identifier": "email OR phone number", "password": "string" }
```

**Logic**
1. Zod validates body
2. Queries `users` where `email = identifier` OR `phone_number = identifier`
3. Checks `is_active`
4. `bcrypt.compare` password
5. Fetches all `sub_company_users` rows for the user → `subCompanyIds[]`
6. Signs JWT with `{ sub, role, subCompanyIds }`

**Response `200`**
```json
{
  "token": "<jwt>",
  "user": {
    "id": "uuid",
    "name": "string",
    "email": "string",
    "phoneNumber": "string",
    "role": "owner|admin|floor_manager|member",
    "subCompanyIds": ["uuid", "..."]
  }
}
```

**Error responses**: `400` bad body · `401` wrong credentials · `403` deactivated account
