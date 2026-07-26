import { pgTable, uuid, varchar, doublePrecision, text, timestamp, index } from 'drizzle-orm/pg-core';
import { products } from '../products/products';
import { purchaseOrders } from './purchase-orders';
import { users } from '../auth/users';

export const stockBatches = pgTable('stock_batches', {
  id:              uuid('id').primaryKey().defaultRandom(),
  productId:       uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id, { onDelete: 'set null' }),
  lotNumber:       varchar('lot_number', { length: 100 }),
  quantity:        doublePrecision('quantity').notNull(),
  unitCost:        doublePrecision('unit_cost'),
  totalCost:       doublePrecision('total_cost'),
  receivedAt:      timestamp('received_at').notNull().defaultNow(),
  createdBy:       uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  notes:           text('notes'),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('batch_product_idx').on(t.productId),
  index('batch_po_idx').on(t.purchaseOrderId),
]);

export type StockBatch    = typeof stockBatches.$inferSelect;
export type NewStockBatch = typeof stockBatches.$inferInsert;
