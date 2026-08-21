import { pgTable, uuid, varchar, doublePrecision, text, timestamp, index } from 'drizzle-orm/pg-core';
import { quotes } from './quotes';
import { products } from '../products/products';

export const quoteItems = pgTable('quote_items', {
  id:          uuid('id').primaryKey().defaultRandom(),
  quoteId:     uuid('quote_id').notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  productId:   uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  // Defaults to the product's name at add-time, but editable per quote line
  displayName: varchar('display_name', { length: 255 }).notNull(),
  quantity:    doublePrecision('quantity').notNull(),
  unitPrice:   doublePrecision('unit_price'),
  totalAmount: doublePrecision('total_amount'),
  notes:       text('notes'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('qi_quote_idx').on(t.quoteId),
  index('qi_product_idx').on(t.productId),
]);

export type QuoteItem    = typeof quoteItems.$inferSelect;
export type NewQuoteItem = typeof quoteItems.$inferInsert;
