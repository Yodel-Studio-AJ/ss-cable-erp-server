import { pgTable, uuid, varchar, timestamp, pgEnum, boolean } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'owner',
  'admin',
  'floor_manager',
  'member',
]);

export const users = pgTable('users', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        varchar('name', { length: 255 }).notNull(),
  email:       varchar('email', { length: 255 }).notNull().unique(),
  phoneNumber: varchar('phone_number', { length: 20 }).notNull().unique(),
  password:    varchar('password', { length: 255 }).notNull(),
  role:        userRoleEnum('role').notNull().default('member'),
  isActive:    boolean('is_active').notNull().default(true),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
});

export type User    = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
