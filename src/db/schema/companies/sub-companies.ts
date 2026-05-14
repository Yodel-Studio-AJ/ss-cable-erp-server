import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';

export const subCompanies = pgTable('sub_companies', {
  id:        uuid('id').primaryKey().defaultRandom(),
  name:      varchar('name', { length: 255 }).notNull(),
  address:   text('address'),
  city:      varchar('city', { length: 100 }),
  phone:     varchar('phone', { length: 20 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type SubCompany    = typeof subCompanies.$inferSelect;
export type NewSubCompany = typeof subCompanies.$inferInsert;
