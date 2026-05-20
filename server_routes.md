# Server — Route Reference

All routes are prefixed with `/api` unless noted. Auth-required routes expect `Authorization: Bearer <token>`.

---

## System

| Method | Path | Auth | Roles |
|--------|------|------|-------|
| GET | `/health` | none | — |

---

## Auth  `/api/auth`

| Method | Path | Auth | Roles |
|--------|------|------|-------|
| POST | `/api/auth/register` | none | — |
| POST | `/api/auth/login` | none | — |
| POST | `/api/auth/refresh` | none | — |
| POST | `/api/auth/logout` | required | any |
| GET | `/api/auth/me` | required | any |
| PATCH | `/api/auth/me/password` | required | any |

---

## Users  `/api/users`

| Method | Path | Auth | Roles |
|--------|------|------|-------|
| GET | `/api/users` | required | owner, admin |
| GET | `/api/users/:id` | required | owner, admin |
| POST | `/api/users` | required | owner, admin |
| PATCH | `/api/users/:id` | required | owner, admin |
| DELETE | `/api/users/:id` | required | owner |

> Admin access is scoped to users within their own sub-companies. Admins can only create `floor_manager` or `member` roles.

---

## Sub-Companies  `/api/sub-companies`

| Method | Path | Auth | Roles |
|--------|------|------|-------|
| GET | `/api/sub-companies` | required | owner |
| GET | `/api/sub-companies/:id` | required | owner, admin |
| POST | `/api/sub-companies` | required | owner |
| PATCH | `/api/sub-companies/:id` | required | owner |
| DELETE | `/api/sub-companies/:id` | required | owner |
| GET | `/api/sub-companies/:id/users` | required | owner, admin |
| POST | `/api/sub-companies/:id/users` | required | owner, admin |
| PATCH | `/api/sub-companies/:id/users/:userId` | required | owner, admin |
| DELETE | `/api/sub-companies/:id/users/:userId` | required | owner, admin |

---

## Product Groups  `/api/product-groups`

| Method | Path | Auth | Roles |
|--------|------|------|-------|
| GET | `/api/product-groups` | required | any |
| GET | `/api/product-groups/:id` | required | any |
| POST | `/api/product-groups` | required | owner, admin |
| PATCH | `/api/product-groups/:id` | required | owner, admin |
| DELETE | `/api/product-groups/:id` | required | owner |

---

## Request / Response Shapes

### `POST /api/auth/register`

> Bootstrap only — creates the first owner account. Returns `403` if any user already exists.

Request: `{ "name": "string", "email": "string", "phoneNumber": "string", "password": "string (min 8)" }`
Response `201`: same shape as login `200`

---

### `POST /api/auth/login`

Request: `{ "identifier": "email or phone", "password": "string" }`

Response `200`:
```json
{
  "accessToken": "<jwt, 15m>",
  "refreshToken": "<jwt, 7d>",
  "user": { "id": "uuid", "name": "string", "email": "string", "phoneNumber": "string", "role": "owner|admin|floor_manager|member", "subCompanyIds": ["uuid"] }
}
```

---

### `POST /api/auth/refresh`

Request: `{ "refreshToken": "<jwt>" }` → Response `200`: `{ "accessToken": "<jwt>" }`

---

### `POST /api/users`

Request:
```json
{ "name": "string", "email": "string", "phoneNumber": "string", "password": "string (min 8)", "role": "owner|admin|floor_manager|member" }
```

Response `201`: user object (no password field)

---

### `POST /api/sub-companies`

Request: `{ "name": "string", "address"?: "string", "city"?: "string", "phone"?: "string" }`
Response `201`: sub-company object

---

### `POST /api/sub-companies/:id/users`

Request: `{ "userId": "uuid", "isPrimary": false }`
Response `201`: membership object

---

### `PATCH /api/sub-companies/:id/users/:userId`

Request: `{ "isPrimary": true }`
Response `200`: updated membership object

---

### `POST /api/product-groups`

Request:
```json
{
  "name": "string",
  "type": "raw_material | intermediate | finished_goods | processed_product",
  "isProcured": true,
  "materialType": "metal | pvc | mixed"
}
```

Response `201`: product group object

---

### JWT payload (access token)

```json
{ "sub": "uuid", "role": "owner|admin|floor_manager|member", "subCompanyIds": ["uuid"], "iat": 0, "exp": 0 }
```
