import { pgTable, uuid, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../auth/users';

export const attendanceSettings = pgTable('attendance_settings', {
  userId:          uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  isAlwaysPresent: boolean('is_always_present').notNull().default(false),
  updatedAt:       timestamp('updated_at').notNull().defaultNow(),
});

export type AttendanceSetting    = typeof attendanceSettings.$inferSelect;
export type NewAttendanceSetting = typeof attendanceSettings.$inferInsert;
