# Server — To Be Implemented

Items are loosely ordered by dependency. Update this file as things get built (move them to `server_implemented.md`).

---

## Infrastructure

- [ ] Global error handler middleware (central Express `app.use((err, req, res, next) => ...)`)
- [ ] Request logging (morgan or pino)
- [ ] Rate limiting on auth routes
- [ ] Pagination helper for list endpoints
- [ ] Refresh token table + rotation logic (currently stateless / no blocklist)

---

## Domain Tables (not yet designed)

These will be needed as the ERP grows. Schema + routes TBD.

- [ ] Products / SKUs
- [ ] Inventory stock levels (per sub-company)
- [ ] Purchase Orders
- [ ] Sales / Transactions
- [ ] Suppliers
- [ ] Reports (aggregated, cross-sub-company for owner)
