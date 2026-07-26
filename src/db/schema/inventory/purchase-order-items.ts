import { pgTable, uuid, doublePrecision, text, timestamp, index } from 'drizzle-orm/pg-core';
import { purchaseOrders } from './purchase-orders';
import { products } from '../products/products';

export const purchaseOrderItems = pgTable('purchase_order_items', {
  id:               uuid('id').primaryKey().defaultRandom(),
  purchaseOrderId:  uuid('purchase_order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  productId:        uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  quantityOrdered:  doublePrecision('quantity_ordered').notNull(),
  unitPrice:        doublePrecision('unit_price'),
  totalAmount:      doublePrecision('total_amount'),
  quantityReceived: doublePrecision('quantity_received').notNull().default(0),
  deliveredAt:      timestamp('delivered_at'),
  notes:            text('notes'),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('poi_po_idx').on(t.purchaseOrderId),
  index('poi_product_idx').on(t.productId),
]);

export type PurchaseOrderItem    = typeof purchaseOrderItems.$inferSelect;
export type NewPurchaseOrderItem = typeof purchaseOrderItems.$inferInsert;
