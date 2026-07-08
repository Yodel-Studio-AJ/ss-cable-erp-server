import { pgTable, uuid, primaryKey } from 'drizzle-orm/pg-core';
import { vendors } from './vendors';
import { productGroups } from '../products/product-groups';

export const vendorProductGroups = pgTable('vendor_product_groups', {
  vendorId:       uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  productGroupId: uuid('product_group_id').notNull().references(() => productGroups.id, { onDelete: 'cascade' }),
}, (t) => [
  primaryKey({ columns: [t.vendorId, t.productGroupId] }),
]);

export type VendorProductGroup    = typeof vendorProductGroups.$inferSelect;
export type NewVendorProductGroup = typeof vendorProductGroups.$inferInsert;
