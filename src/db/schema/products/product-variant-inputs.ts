import { pgTable, uuid, timestamp, unique } from 'drizzle-orm/pg-core';
import { products }           from './products';
import { productGroupInputs } from './product-group-inputs';

export const productVariantInputs = pgTable('product_variant_inputs', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  // the output product variant this selection belongs to
  outputProductId:     uuid('output_product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  // which BOM input row (productGroupInputs) this selection satisfies
  productGroupInputId: uuid('product_group_input_id').notNull().references(() => productGroupInputs.id, { onDelete: 'cascade' }),
  // the specific input product variant chosen
  inputProductId:      uuid('input_product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  createdAt:           timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  unique('pvi_unique').on(t.outputProductId, t.productGroupInputId),
]);
