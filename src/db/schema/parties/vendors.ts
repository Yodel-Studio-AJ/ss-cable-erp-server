import {
  pgTable, uuid, varchar, timestamp, index, pgEnum,
} from 'drizzle-orm/pg-core';
import { users } from '../auth/users';

export const vendorTypeEnum = pgEnum('vendor_type', [
  'manufacturer',
  'distributor',
  'wholesaler',
  'trader',
]);

export const vendors = pgTable('vendors', {
  id:              uuid('id').primaryKey().defaultRandom(),
  orgId:           uuid('org_id'),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),

  // Identity
  companyName:         varchar('company_name', { length: 255 }).notNull(),
  vendorType:          vendorTypeEnum('vendor_type').notNull().default('trader'),
  specialization:      varchar('specialization', { length: 255 }),
  gstin:               varchar('gstin', { length: 20 }),

  // Address
  address: varchar('address', { length: 500 }),
  city:    varchar('city', { length: 100 }),
  state:   varchar('state', { length: 100 }),
  pincode: varchar('pincode', { length: 10 }),

  // Embedded primary contact
  contactName:        varchar('contact_name', { length: 255 }).notNull(),
  contactPhone:       varchar('contact_phone', { length: 20 }),
  contactEmail:       varchar('contact_email', { length: 255 }),
  contactDesignation: varchar('contact_designation', { length: 100 }),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('vendors_org_id_idx').on(t.orgId),
  index('vendors_created_by_idx').on(t.createdByUserId),
]);

export type Vendor    = typeof vendors.$inferSelect;
export type NewVendor = typeof vendors.$inferInsert;
