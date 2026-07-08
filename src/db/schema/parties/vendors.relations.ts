import { relations } from 'drizzle-orm';
import { vendors } from './vendors';
import { vendorProductGroups } from './vendor-product-groups';
import { vendorBranches } from './vendor-branches';
import { productGroups } from '../products/product-groups';
import { subCompanies } from '../companies/sub-companies';

export const vendorsRelations = relations(vendors, ({ many }) => ({
  vendorProductGroups: many(vendorProductGroups),
  vendorBranches:      many(vendorBranches),
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

export const vendorBranchesRelations = relations(vendorBranches, ({ one }) => ({
  vendor: one(vendors, {
    fields: [vendorBranches.vendorId],
    references: [vendors.id],
  }),
  subCompany: one(subCompanies, {
    fields: [vendorBranches.subCompanyId],
    references: [subCompanies.id],
  }),
}));
