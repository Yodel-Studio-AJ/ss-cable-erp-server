import { pgTable, uuid, text, varchar, integer, numeric, timestamp, index, jsonb } from 'drizzle-orm/pg-core';
import { productGroups } from './product-groups';

export const productGroupInputs = pgTable('product_group_inputs', {
  id:            uuid('id').primaryKey().defaultRandom(),
  outputGroupId: uuid('output_group_id').notNull().references(() => productGroups.id, { onDelete: 'cascade' }),
  inputGroupId:  uuid('input_group_id').notNull().references(() => productGroups.id, { onDelete: 'cascade' }),
  // formula uses attribute aliases from BOTH output and input group products at calculation time
  qtyFormula:    text('qty_formula').notNull(),
  // result is divided by yield_factor to account for waste/loss (e.g. 0.97 = 3% drawing loss)
  yieldFactor:   numeric('yield_factor', { precision: 7, scale: 4 }).notNull().default('1.0'),
  // maps each alias used in qty_formula to its source pga + group, keyed by alias string
  // e.g. { "density": { "pgaId": "...", "groupId": "...", "groupName": "Copper Rods", "attrName": "Density of Rod" } }
  formulaVars:   jsonb('formula_vars'),
  // label differentiates multiple rows with the same inputGroupId (e.g. "4sq mm wire", "2sq mm wire")
  label:         varchar('label', { length: 100 }),
  sortOrder:     integer('sort_order').notNull().default(0),
  notes:         text('notes'),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('pgi_output_group_idx').on(t.outputGroupId),
  index('pgi_input_group_idx').on(t.inputGroupId),
]);
