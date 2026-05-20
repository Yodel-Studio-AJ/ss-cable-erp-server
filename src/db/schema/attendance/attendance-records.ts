import { pgTable, uuid, date, varchar, pgEnum, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from '../auth/users';

export const attendanceStatusEnum = pgEnum('attendance_status', [
  'present',
  'absent',
  'half_day',
  'leave',
]);

export const attendanceRecords = pgTable(
  'attendance_records',
  {
    id:         uuid('id').primaryKey().defaultRandom(),
    userId:     uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    date:       date('date', { mode: 'string' }).notNull(),
    status:     attendanceStatusEnum('status').notNull(),
    markedById: uuid('marked_by_id').notNull().references(() => users.id),
    note:       varchar('note', { length: 500 }),
    createdAt:  timestamp('created_at').notNull().defaultNow(),
    updatedAt:  timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('att_user_date_uidx').on(t.userId, t.date)],
);

export type AttendanceRecord    = typeof attendanceRecords.$inferSelect;
export type NewAttendanceRecord = typeof attendanceRecords.$inferInsert;
