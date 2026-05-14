# Server — To Be Implemented

Items are loosely ordered by dependency. Update this file as things get built (move them to `server_implemented.md`).

---

## Auth / Users

- [ ] `POST /api/auth/register` — create a new user (owner-only or seeded directly)
- [ ] `POST /api/auth/logout` — token blocklist / refresh token invalidation (if refresh tokens are added)
- [ ] `POST /api/auth/refresh` — issue new access token from a refresh token
- [ ] `GET  /api/auth/me` — return current user profile from token
- [ ] `PATCH /api/auth/me/password` — change own password (requires current password)

## User Management (owner / admin)

- [ ] `GET    /api/users` — list users (owner sees all; admin sees own sub-company)
- [ ] `GET    /api/users/:id` — get single user
- [ ] `POST   /api/users` — create user (owner / admin)
- [ ] `PATCH  /api/users/:id` — update user details / role
- [ ] `DELETE /api/users/:id` — deactivate (soft delete via `is_active = false`)

## Sub-Company Management (owner)

- [ ] `GET    /api/sub-companies` — list all sub-companies
- [ ] `GET    /api/sub-companies/:id` — get single sub-company
- [ ] `POST   /api/sub-companies` — create sub-company
- [ ] `PATCH  /api/sub-companies/:id` — update sub-company
- [ ] `DELETE /api/sub-companies/:id` — delete sub-company

## User ↔ Sub-Company Assignment

- [ ] `GET    /api/sub-companies/:id/users` — list users in a sub-company
- [ ] `POST   /api/sub-companies/:id/users` — assign user to sub-company (set `is_primary`)
- [ ] `DELETE /api/sub-companies/:id/users/:userId` — remove user from sub-company
- [ ] `PATCH  /api/sub-companies/:id/users/:userId` — toggle `is_primary`

## Domain Tables (not yet designed)

These will be needed as the ERP grows. Schema + routes TBD.

- [ ] Products / Inventory
- [ ] Sales / Transactions
- [ ] Purchase Orders
- [ ] Suppliers
- [ ] Reports (aggregated, cross-sub-company for owner)

## Infrastructure

- [ ] Global error handler middleware
- [ ] Request logging (morgan or pino)
- [ ] Rate limiting on auth routes
- [ ] CORS configuration
- [ ] Pagination helper for list endpoints
- [ ] Refresh token table + rotation logic (if added)
