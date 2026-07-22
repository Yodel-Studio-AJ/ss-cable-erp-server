import { pgTable, uuid, varchar, boolean, integer, text, timestamp, unique, index, jsonb } from 'drizzle-orm/pg-core';
import { productGroups } from './product-groups';
import { attributes } from './attributes';

export const productGroupAttributes = pgTable('product_group_attributes', {
  id:             uuid('id').primaryKey().defaultRandom(),
  productGroupId: uuid('product_group_id').notNull().references(() => productGroups.id, { onDelete: 'cascade' }),
  attributeId:    uuid('attribute_id').notNull().references(() => attributes.id, { onDelete: 'cascade' }),

  // Short identifier used as variable name in formula expressions.
  // If null the UI derives it as: name.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'')
  formulaAlias:   varchar('formula_alias', { length: 50 }),

  isCalculated:    boolean('is_calculated').notNull().default(false),
  // Formula string referencing sibling formulaAliases, e.g. "weight / (density * cross_section)"
  formula:         text('formula'),

  // Marks the ONE attribute that defines how products in this group are
  // measured, consumed, or produced (the "quantity basis" / stock unit).
  isQuantityBasis: boolean('is_quantity_basis').notNull().default(false),

  // "From Input Material" kind — formula uses pga_ tokens referencing input group attributes.
  // formulaVars maps each pga_token → { pgaId, groupId, groupName, attrName, alias } for display.
  isFromInput:  boolean('is_from_input').notNull().default(false),
  formulaVars:  jsonb('formula_vars'),

  // Controls display order; also defines evaluation order for formulas
  // (calculated attrs should come after the attrs they reference).
  sortOrder:       integer('sort_order').notNull().default(0),

  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  unique().on(t.productGroupId, t.attributeId),
  index('pga_product_group_idx').on(t.productGroupId),
]);

export type ProductGroupAttribute    = typeof productGroupAttributes.$inferSelect;
export type NewProductGroupAttribute = typeof productGroupAttributes.$inferInsert;
