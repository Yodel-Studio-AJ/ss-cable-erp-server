# Server — Route Reference

All routes are prefixed with `/api` unless noted. Auth-required routes expect `Authorization: Bearer <token>`.

Legend: ✅ implemented · 🔲 not yet built

---

## System

| Method | Path | Auth | Roles | Status |
|--------|------|------|-------|--------|
| GET | `/health` | none | — | ✅ |

---

## Auth  `/api/auth`

| Method | Path | Auth | Roles | Status |
|--------|------|------|-------|--------|
| POST | `/api/auth/login` | none | — | ✅ |
| POST | `/api/auth/register` | none / owner | — | 🔲 |
| POST | `/api/auth/refresh` | none | — | 🔲 |
| POST | `/api/auth/logout` | required | any | 🔲 |
| GET  | `/api/auth/me` | required | any | 🔲 |
| PATCH | `/api/auth/me/password` | required | any | 🔲 |

---

## Users  `/api/users`

| Method | Path | Auth | Roles | Status |
|--------|------|------|-------|--------|
| GET | `/api/users` | required | owner, admin | 🔲 |
| GET | `/api/users/:id` | required | owner, admin | 🔲 |
| POST | `/api/users` | required | owner, admin | 🔲 |
| PATCH | `/api/users/:id` | required | owner, admin | 🔲 |
| DELETE | `/api/users/:id` | required | owner | 🔲 |

---

## Sub-Companies  `/api/sub-companies`

| Method | Path | Auth | Roles | Status |
|--------|------|------|-------|--------|
| GET | `/api/sub-companies` | required | owner | 🔲 |
| GET | `/api/sub-companies/:id` | required | owner, admin | 🔲 |
| POST | `/api/sub-companies` | required | owner | 🔲 |
| PATCH | `/api/sub-companies/:id` | required | owner | 🔲 |
| DELETE | `/api/sub-companies/:id` | required | owner | 🔲 |
| GET | `/api/sub-companies/:id/users` | required | owner, admin | 🔲 |
| POST | `/api/sub-companies/:id/users` | required | owner, admin | 🔲 |
| PATCH | `/api/sub-companies/:id/users/:userId` | required | owner, admin | 🔲 |
| DELETE | `/api/sub-companies/:id/users/:userId` | required | owner, admin | 🔲 |

---

## Request / Response Shapes

### `POST /api/auth/login`

Request:
```json
{ "identifier": "email or phone", "password": "string" }
```

Response `200`:
```json
{
  "token": "<jwt>",
  "user": {
    "id": "uuid",
    "name": "string",
    "email": "string",
    "phoneNumber": "string",
    "role": "owner | admin | floor_manager | member",
    "subCompanyIds": ["uuid"]
  }
}
```

Errors: `400` invalid body · `401` wrong credentials · `403` deactivated

---

### JWT payload

```json
{
  "sub": "user-uuid",
  "role": "owner | admin | floor_manager | member",
  "subCompanyIds": ["uuid", "..."],
  "iat": 0,
  "exp": 0
}
```
