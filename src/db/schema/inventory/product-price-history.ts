import { pgTable, uuid, varchar, doublePrecision, text, timestamp, index } from 'drizzle-orm/pg-core';
import { products } from '../products/products';
import { stockBatches } from './stock-batches';
import { purchaseOrders } from './purchase-orders';
import { users } from '../auth/users';

export const productPriceHistory = pgTable('product_price_history', {
  id:              uuid('id').primaryKey().defaultRandom(),
  productId:       uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  price:           doublePrecision('price').notNull(),
  pricingMethod:   varchar('pricing_method', { length: 30 }).notNull(),
  stockBatchId:    uuid('stock_batch_id').references(() => stockBatches.id, { onDelete: 'set null' }),
  purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id, { onDelete: 'set null' }),
  lotUnitCost:     doublePrecision('lot_unit_cost'),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
  createdBy:       uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  notes:           text('notes'),
}, (t) => [
  index('price_history_product_idx').on(t.productId),
]);

export type ProductPriceHistory    = typeof productPriceHistory.$inferSelect;
export type NewProductPriceHistory = typeof productPriceHistory.$inferInsert;
