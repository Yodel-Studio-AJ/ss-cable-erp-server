import { pgTable, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';
import { customers } from './customers';

export const customerContacts = pgTable('customer_contacts', {
  id:          uuid('id').primaryKey().defaultRandom(),
  customerId:  uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  name:        varchar('name', { length: 255 }).notNull(),
  phone:       varchar('phone', { length: 20 }),
  email:       varchar('email', { length: 255 }),
  designation: varchar('designation', { length: 100 }),
  isPrimary:   boolean('is_primary').notNull().default(false),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
});

export type CustomerContact    = typeof customerContacts.$inferSelect;
export type NewCustomerContact = typeof customerContacts.$inferInsert;
