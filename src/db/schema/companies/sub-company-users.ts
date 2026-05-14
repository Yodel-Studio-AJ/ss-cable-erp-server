import { pgTable, uuid, boolean, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { users } from '../auth/users';
import { subCompanies } from './sub-companies';

export const subCompanyUsers = pgTable(
  'sub_company_users',
  {
    userId:       uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    subCompanyId: uuid('sub_company_id').notNull().references(() => subCompanies.id, { onDelete: 'cascade' }),
    isPrimary:    boolean('is_primary').notNull().default(false),
    createdAt:    timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.subCompanyId] })],
);

export type SubCompanyUser    = typeof subCompanyUsers.$inferSelect;
export type NewSubCompanyUser = typeof subCompanyUsers.$inferInsert;
