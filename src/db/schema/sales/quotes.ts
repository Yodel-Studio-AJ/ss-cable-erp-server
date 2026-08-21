import { pgTable, uuid, varchar, text, date, timestamp, index } from 'drizzle-orm/pg-core';
import { customers } from '../parties/customers';
import { users } from '../auth/users';

// status: draft → sent → accepted | rejected | expired
export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired'] as const;
export type QuoteStatus = typeof QUOTE_STATUSES[number];

export const quotes = pgTable('quotes', {
  id:          uuid('id').primaryKey().defaultRandom(),
  quoteNumber: varchar('quote_number', { length: 50 }).notNull().unique(),
  customerId:  uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  status:      varchar('status', { length: 20 }).notNull().default('draft'),
  notes:       text('notes'),
  validUntil:  date('valid_until'),
  createdBy:   uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('quote_customer_idx').on(t.customerId),
  index('quote_status_idx').on(t.status),
]);

export type Quote    = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
