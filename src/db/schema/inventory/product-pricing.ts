import { pgTable, uuid, varchar, doublePrecision, timestamp } from 'drizzle-orm/pg-core';
import { products } from '../products/products';

export const PRICING_METHODS = [
  'weighted_average', // Σ(qty × cost) / Σ(qty) — reflects true average holding cost
  'average_all',      // simple mean of all batch unit costs
  'latest_lot',       // unit cost of most recently received lot
  'oldest_lot',       // unit cost of oldest lot received
  'manual',           // price is set manually, not recalculated on delivery
] as const;
export type PricingMethod = typeof PRICING_METHODS[number];

export const productPricing = pgTable('product_pricing', {
  id:            uuid('id').primaryKey().defaultRandom(),
  productId:     uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }).unique(),
  pricingMethod: varchar('pricing_method', { length: 30 }).notNull().default('weighted_average'),
  currentPrice:  doublePrecision('current_price'),
  updatedAt:     timestamp('updated_at').notNull().defaultNow(),
});

export type ProductPricing    = typeof productPricing.$inferSelect;
export type NewProductPricing = typeof productPricing.$inferInsert;
