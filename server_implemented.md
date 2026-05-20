# Server — Implemented

Stack: **Node.js · Express · TypeScript · Drizzle ORM · postgres.js · PostgreSQL · JWT · bcryptjs · Zod**

---

## Project Setup

| File | What it does |
|------|-------------|
| `package.json` | deps + scripts: `dev`, `build`, `start`, `db:generate`, `db:migrate`, `db:studio` |
| `tsconfig.json` | strict TS, ES2022, CommonJS output to `dist/` |
| `.env` / `.env.example` | `DATABASE_URL`, `JWT_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `PORT`, `CLIENT_ORIGIN` |
| `.gitignore` | ignores `node_modules/`, `dist/`, `.env`, `drizzle/meta/` |
| `drizzle.config.ts` | drizzle-kit CLI — schema: `src/db/schema/index.ts`, out: `drizzle/` |

---

## Database Schema

### Schema folder structure

```
src/db/schema/
  index.ts                              ← barrel re-export of everything below
  auth/
    users.ts                            ← users table + userRoleEnum
    users.relations.ts                  ← users → many subCompanyUsers
  companies/
    sub-companies.ts                    ← sub_companies table
    sub-companies.relations.ts          ← subCompanies → many subCompanyUsers
    sub-company-users.ts                ← sub_company_users join table
    sub-company-users.relations.ts      ← subCompanyUsers → one user, one subCompany
  products/
    product-groups.ts                   ← product_groups table + enums
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

### `product_groups` table (`src/db/schema/products/product-groups.ts`)

| Column | DB type | Constraints |
|--------|---------|-------------|
| `id` | uuid | PK, defaultRandom |
| `name` | varchar(255) | not null, unique |
| `type` | enum `product_group_type` | `raw_material` / `intermediate` / `finished_goods` / `processed_product` |
| `is_procured` | boolean | not null |
| `material_type` | enum `material_type` | `metal` / `pvc` / `mixed` |
| `created_at` | timestamp | defaultNow |
| `updated_at` | timestamp | defaultNow |

---

## Infrastructure

| File | What it does |
|------|-------------|
| `src/db/connection.ts` | Exports singleton `db` (drizzle wrapping a postgres.js client) |
| `src/lib/jwt.ts` | `signToken(payload)` / `verifyToken(token)` / `signRefreshToken(sub)` / `verifyRefreshToken(token)` — access payload: `{ sub, role, subCompanyIds }`, refresh payload: `{ sub, tokenType: 'refresh' }` |
| `src/lib/app-error.ts` | `AppError` class with `message` + `statusCode` for consistent error throwing |
| `src/middleware/auth.middleware.ts` | `requireAuth` — validates Bearer JWT; `requireRole(...roles)` — 403 if role not in list |
| `src/routes/index.ts` | Aggregates all route modules under `/api` |
| `src/index.ts` | Express entry — CORS, JSON body parser, `/health`, mounts `/api` |

---

## Routes

### `GET /health`
Returns `{ status: "ok" }`. No auth required.

---

### Auth — `src/routes/auth.routes.ts`

#### `POST /api/auth/register`
First-user-only registration (becomes `owner`). Subsequent users must be created via `/api/users`.

**Request body**
```json
{ "name": "string", "email": "string", "phoneNumber": "string", "password": "string (min 8)" }
```
**Response `201`** — `{ accessToken, refreshToken, user }`

#### `POST /api/auth/login`
Login with email **or** phone number.

**Request body**
```json
{ "identifier": "email OR phone number", "password": "string" }
```
**Response `200`** — `{ accessToken, refreshToken, user }`

#### `POST /api/auth/refresh`
Exchange a valid refresh token for a new access token.

**Request body**
```json
{ "refreshToken": "string" }
```
**Response `200`** — `{ accessToken, refreshToken }`

#### `POST /api/auth/logout`
Stateless — client discards tokens. Returns `204 No Content`.
Requires: `Bearer <accessToken>`

#### `GET /api/auth/me`
Returns current user profile from token.
Requires: `Bearer <accessToken>`
**Response `200`** — user object

#### `PATCH /api/auth/me/password`
Change own password.
Requires: `Bearer <accessToken>`

**Request body**
```json
{ "currentPassword": "string", "newPassword": "string (min 8)" }
```
**Response `204`**

---

### Users — `src/routes/users.routes.ts`
All routes require `Bearer <accessToken>`.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/users` | owner, admin | List all users |
| GET | `/api/users/:id` | owner, admin | Get single user |
| POST | `/api/users` | owner, admin | Create user |
| PATCH | `/api/users/:id` | owner, admin | Update user details / role |
| DELETE | `/api/users/:id` | owner | Soft-delete (`is_active = false`) |

---

### Sub-Companies — `src/routes/sub-companies.routes.ts`
All routes require `Bearer <accessToken>`.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/sub-companies` | owner | List all sub-companies |
| GET | `/api/sub-companies/:id` | owner, admin | Get single sub-company |
| POST | `/api/sub-companies` | owner | Create sub-company |
| PATCH | `/api/sub-companies/:id` | owner | Update sub-company |
| DELETE | `/api/sub-companies/:id` | owner | Delete sub-company |
| GET | `/api/sub-companies/:id/users` | owner, admin | List members |
| POST | `/api/sub-companies/:id/users` | owner, admin | Assign user to sub-company |
| PATCH | `/api/sub-companies/:id/users/:userId` | owner, admin | Toggle `is_primary` |
| DELETE | `/api/sub-companies/:id/users/:userId` | owner, admin | Remove user from sub-company |

---

### Product Groups — `src/routes/product-groups.routes.ts`
All routes require `Bearer <accessToken>`.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/product-groups` | any authenticated | List all product groups |
| GET | `/api/product-groups/:id` | any authenticated | Get single product group |
| POST | `/api/product-groups` | owner, admin | Create product group |
| PATCH | `/api/product-groups/:id` | owner, admin | Update product group |
| DELETE | `/api/product-groups/:id` | owner | Delete product group |
