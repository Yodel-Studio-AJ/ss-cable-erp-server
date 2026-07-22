import { pgTable, uuid, doublePrecision, varchar, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { products } from './products';
import { productGroupAttributes } from './product-group-attributes';

export const productAttributeValues = pgTable('product_attribute_values', {
  id:                      uuid('id').primaryKey().defaultRandom(),
  productId:               uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  productGroupAttributeId: uuid('product_group_attribute_id').notNull().references(() => productGroupAttributes.id, { onDelete: 'cascade' }),
  // For numeric attributes (most cable attributes are numbers)
  numericValue:            doublePrecision('numeric_value'),
  // For string attributes
  textValue:               varchar('text_value', { length: 500 }),
  createdAt:               timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  unique().on(t.productId, t.productGroupAttributeId),
  index('pav_product_idx').on(t.productId),
]);

export type ProductAttributeValue    = typeof productAttributeValues.$inferSelect;
export type NewProductAttributeValue = typeof productAttributeValues.$inferInsert;
