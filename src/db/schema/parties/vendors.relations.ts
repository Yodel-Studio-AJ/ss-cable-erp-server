import { relations } from 'drizzle-orm';
import { vendors } from './vendors';
import { vendorProductGroups } from './vendor-product-groups';
import { productGroups } from '../products/product-groups';

export const vendorsRelations = relations(vendors, ({ many }) => ({
  vendorProductGroups: many(vendorProductGroups),
}));

export const vendorProductGroupsRelations = relations(vendorProductGroups, ({ one }) => ({
  vendor: one(vendors, {
    fields: [vendorProductGroups.vendorId],
    references: [vendors.id],
  }),
  productGroup: one(productGroups, {
    fields: [vendorProductGroups.productGroupId],
    references: [productGroups.id],
  }),
}));
