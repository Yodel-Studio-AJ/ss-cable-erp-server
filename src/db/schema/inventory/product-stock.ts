import { pgTable, uuid, doublePrecision, timestamp } from 'drizzle-orm/pg-core';
import { products } from '../products/products';

export const productStock = pgTable('product_stock', {
  id:                uuid('id').primaryKey().defaultRandom(),
  productId:         uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }).unique(),
  quantityOnHand:    doublePrecision('quantity_on_hand').notNull().default(0),
  lowStockThreshold: doublePrecision('low_stock_threshold'),
  updatedAt:         timestamp('updated_at').notNull().defaultNow(),
});

export type ProductStock    = typeof productStock.$inferSelect;
export type NewProductStock = typeof productStock.$inferInsert;
