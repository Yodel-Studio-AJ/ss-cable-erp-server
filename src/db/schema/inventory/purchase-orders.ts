import { pgTable, uuid, varchar, text, date, timestamp, index } from 'drizzle-orm/pg-core';
import { vendors } from '../parties/vendors';
import { users } from '../auth/users';

// status: draft → confirmed → in_transit → delivered | cancelled
export const PO_STATUSES = ['draft', 'confirmed', 'in_transit', 'delivered', 'cancelled'] as const;
export type PoStatus = typeof PO_STATUSES[number];

export const purchaseOrders = pgTable('purchase_orders', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  poNumber:             varchar('po_number', { length: 50 }).notNull().unique(),
  vendorId:             uuid('vendor_id').references(() => vendors.id, { onDelete: 'set null' }),
  status:               varchar('status', { length: 20 }).notNull().default('draft'),
  notes:                text('notes'),
  expectedDeliveryDate: date('expected_delivery_date'),
  deliveredAt:          timestamp('delivered_at'),
  createdBy:            uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt:            timestamp('created_at').notNull().defaultNow(),
  updatedAt:            timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('po_vendor_idx').on(t.vendorId),
  index('po_status_idx').on(t.status),
]);

export type PurchaseOrder    = typeof purchaseOrders.$inferSelect;
export type NewPurchaseOrder = typeof purchaseOrders.$inferInsert;
