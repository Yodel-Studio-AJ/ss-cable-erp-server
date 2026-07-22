import { pgTable, uuid, varchar, boolean, text, timestamp, index } from 'drizzle-orm/pg-core';
import { productGroups } from './product-groups';

export const products = pgTable('products', {
  id:             uuid('id').primaryKey().defaultRandom(),
  productGroupId: uuid('product_group_id').notNull().references(() => productGroups.id, { onDelete: 'cascade' }),
  name:           varchar('name', { length: 255 }).notNull(),
  sku:            varchar('sku', { length: 100 }).unique(),
  description:    text('description'),
  isActive:       boolean('is_active').notNull().default(true),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
  updatedAt:      timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('products_group_idx').on(t.productGroupId),
]);

export type Product    = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
