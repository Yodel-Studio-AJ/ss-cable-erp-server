import { pgTable, uuid, primaryKey } from 'drizzle-orm/pg-core';
import { vendors } from './vendors';
import { subCompanies } from '../companies/sub-companies';

export const vendorBranches = pgTable('vendor_branches', {
  vendorId:     uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  subCompanyId: uuid('sub_company_id').notNull().references(() => subCompanies.id, { onDelete: 'cascade' }),
}, (t) => [
  primaryKey({ columns: [t.vendorId, t.subCompanyId] }),
]);

export type VendorBranch    = typeof vendorBranches.$inferSelect;
export type NewVendorBranch = typeof vendorBranches.$inferInsert;
