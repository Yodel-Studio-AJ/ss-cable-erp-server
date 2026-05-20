import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../auth/users';

export const customers = pgTable('customers', {
  id:              uuid('id').primaryKey().defaultRandom(),
  orgId:           uuid('org_id'),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  companyName:     varchar('company_name', { length: 255 }).notNull(),
  industry:        varchar('industry', { length: 100 }),
  gstin:           varchar('gstin', { length: 20 }),
  address:         text('address'),
  city:            varchar('city', { length: 100 }),
  state:           varchar('state', { length: 100 }),
  pincode:         varchar('pincode', { length: 10 }),
  notes:           text('notes'),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
  updatedAt:       timestamp('updated_at').notNull().defaultNow(),
});

export type Customer    = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
