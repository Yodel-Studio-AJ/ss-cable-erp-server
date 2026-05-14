# Drizzle ORM Setup — Reusable Reference

Stack: **Express + TypeScript + Drizzle ORM + postgres.js + PostgreSQL**

---

## 1. Install packages

```bash
npm install drizzle-orm postgres dotenv
npm install -D drizzle-kit tsx @types/node
```

---

## 2. Folder structure

```
src/
  db/
    connection.ts          # creates and exports the db instance
    schema/
      index.ts             # re-exports all tables
      users.ts             # one file per table/domain
      organizations.ts
      ...
drizzle/                   # auto-generated — migration SQL files land here
drizzle.config.ts          # drizzle-kit config (used by CLI only)
.env
```

---

## 3. `.env`

```env
DATABASE_URL=postgres://user:password@localhost:5432/your_db
```

---

## 4. `drizzle.config.ts` — CLI config

Drizzle-kit reads this when you run `generate` or `migrate`. It is **not** imported by your app at runtime.

```ts
import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config();

export default defineConfig({
  schema: './src/db/schema/index.ts',   // where your table definitions live
  out: './drizzle',                     // where migration SQL files are written
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

---

## 5. `src/db/connection.ts` — runtime DB instance

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/your_db';

const client = postgres(connectionString);

export const db = drizzle(client, { schema });
export type DB = typeof db;
```

- `postgres(connectionString)` — creates the raw connection pool via `postgres.js`
- `drizzle(client, { schema })` — wraps the pool; passing `{ schema }` enables the relational query API (`db.query.users.findMany(...)`)
- Export `db` once and import it everywhere — it is a singleton

---

## 6. `src/db/schema/index.ts` — schema barrel

Re-export every table file so `drizzle.config.ts` and `connection.ts` only need one import path:

```ts
export * from './organizations';
export * from './users';
// export * from './your_table';
```

---

## 7. Schema file pattern (one per domain)

```ts
// src/db/schema/users.ts
import { pgTable, uuid, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

// Enums must be declared before the table that uses them
export const userRoleEnum = pgEnum('user_role', ['owner', 'admin', 'member']);

export const users = pgTable('users', {
  id:        uuid('id').primaryKey().defaultRandom(),
  email:     varchar('email', { length: 255 }).notNull().unique(),
  password:  varchar('password', { length: 255 }).notNull(),
  name:      varchar('name', { length: 255 }).notNull(),
  role:      userRoleEnum('role').notNull().default('member'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// TypeScript types inferred from the schema — no separate interface needed
export type User    = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

Key helpers from `drizzle-orm/pg-core`:

| Helper | Use |
|---|---|
| `pgTable` | define a table |
| `uuid` | UUID column |
| `varchar(name, { length })` | string column |
| `text` | unbounded string |
| `integer` / `numeric` | numbers |
| `boolean` | bool |
| `timestamp` | date-time |
| `jsonb` | JSON blob |
| `pgEnum` | Postgres ENUM type |
| `.references(() => other.id)` | FK constraint |
| `.defaultRandom()` | auto UUID |
| `.defaultNow()` | auto timestamp |
| `.notNull()` | NOT NULL |
| `.unique()` | UNIQUE |

---

## 8. `package.json` scripts

```json
"scripts": {
  "dev":          "tsx watch src/index.ts",
  "build":        "tsc",
  "start":        "node dist/index.js",
  "db:generate":  "drizzle-kit generate",
  "db:migrate":   "drizzle-kit migrate"
}
```

| Command | What it does |
|---|---|
| `npm run db:generate` | Diffs your schema against the last migration and writes a new `.sql` file into `drizzle/` |
| `npm run db:migrate` | Applies all pending `.sql` files in `drizzle/` to the database |

**Workflow:**
1. Edit a schema file
2. `npm run db:generate` — creates `drizzle/000N_name.sql`
3. `npm run db:migrate` — pushes it to the DB
4. Commit both the schema file and the generated SQL

---

## 9. Querying

```ts
import { db } from '../db/connection';
import { users } from '../db/schema';
import { eq, and } from 'drizzle-orm';

// Relational query (needs { schema } passed to drizzle())
const user = await db.query.users.findFirst({
  where: eq(users.id, id),
  with: { org: true },       // join — only works if relation is declared
});

// SQL-like query builder
const rows = await db
  .select()
  .from(users)
  .where(and(eq(users.orgId, orgId), eq(users.role, 'admin')));

// Insert
const [newUser] = await db.insert(users).values({ ... }).returning();

// Update
await db.update(users).set({ name: 'New' }).where(eq(users.id, id));

// Delete
await db.delete(users).where(eq(users.id, id));

// Transaction
await db.transaction(async (tx) => {
  const [org] = await tx.insert(organizations).values({ ... }).returning();
  await tx.insert(users).values({ orgId: org.id, ... });
});
```

---

## 10. Declaring relations (for `db.query` joins)

Relations are **metadata only** — they don't change the DB schema, just tell Drizzle how to do relational queries.

```ts
import { relations } from 'drizzle-orm';
import { users } from './users';
import { organizations } from './organizations';

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
}));

export const usersRelations = relations(users, ({ one }) => ({
  org: one(organizations, {
    fields: [users.orgId],
    references: [organizations.id],
  }),
}));
```

Export these from `schema/index.ts` alongside the table definitions.
