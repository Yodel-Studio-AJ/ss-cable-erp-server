# SS Cable ERP — Product Concept

## What is SS Cable?

SS Cable is a cable distribution/retail company that operates through **multiple physical store locations** spread across different cities or areas. Each store location is called a **sub company** in this system.

---

## Sub Companies (Store Locations)

Each sub company represents one store or branch of SS Cable. They operate semi-independently — they have their own inventory, sales, staff, and financials — but they are all part of the same parent company.

Examples:
- SS Cable — Kolkata North
- SS Cable — Kolkata South
- SS Cable — Howrah

---

## Role Hierarchy

| Role | Scope | Description |
|------|-------|-------------|
| `owner` | **All sub companies** | The business owner(s). Can view and compare data across every sub company. Has full read/write access everywhere. |
| `admin` | One or more sub companies | Manages operations for their assigned sub company/companies. Can handle staff, inventory, billing. |
| `floor_manager` | One or more sub companies | Manages day-to-day floor operations at their assigned location(s). |
| `member` | One or more sub companies | Regular staff at their assigned location(s). |

---

## Multi-Sub-Company Membership

A user (non-owner) **belongs to one sub company by default**, but:

- Their sub company assignment can be **changed** (e.g., transferred to a different branch).
- A single user can **belong to multiple sub companies simultaneously** (e.g., a manager overseeing two nearby branches).
- The `sub_company_users` join table tracks these memberships, with an `is_primary` flag to indicate their main location.

Owners bypass this — they always see everything.

---

## Owner's Cross-Company View

The owner role is designed to support **business intelligence across all branches**:

- Compare sales across sub companies
- See aggregate inventory
- Monitor staff and performance per location
- Identify which branches are performing well vs underperforming

---

## Authentication

Users can log in with **either their email address or phone number**, combined with their password. Both fields are unique per user at the database level.

The access token (JWT) contains:
- `sub` — user ID
- `role` — the user's role
- `subCompanyIds` — list of sub company IDs the user belongs to (empty for owners since they access all)

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `users` | All users with role, email, phone, hashed password |
| `sub_companies` | Each store/branch location |
| `sub_company_users` | Many-to-many: which users belong to which sub companies |
