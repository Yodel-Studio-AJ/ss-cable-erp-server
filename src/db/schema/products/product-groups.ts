import { pgTable, uuid, varchar, pgEnum, boolean, timestamp } from 'drizzle-orm/pg-core';

export const productGroupTypeEnum = pgEnum('product_group_type', [
  'raw_material',
  'intermediate',
  'finished_goods',
  'processed_product',
]);

export const materialTypeEnum = pgEnum('material_type', ['metal', 'pvc', 'mixed']);

export const productGroups = pgTable('product_groups', {
  id:           uuid('id').primaryKey().defaultRandom(),
  name:         varchar('name', { length: 255 }).notNull().unique(),
  type:         productGroupTypeEnum('type').notNull(),
  isProcured:   boolean('is_procured').notNull(),
  materialType: materialTypeEnum('material_type').notNull(),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
});

export type ProductGroup    = typeof productGroups.$inferSelect;
export type NewProductGroup = typeof productGroups.$inferInsert;
