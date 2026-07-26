import { eq, desc, inArray } from 'drizzle-orm';
import { db } from '../db/connection';
import {
  purchaseOrders, purchaseOrderItems, stockBatches, productStock, productPricing, products, vendors,
} from '../db/schema';
import type { PoStatus } from '../db/schema/inventory/purchase-orders';
import { recalculatePrice, ensureStockRow } from './stock.service';
import { AppError } from '../lib/app-error';

// ─── types ────────────────────────────────────────────────────────────────────

export interface PoItemInput {
  productId:        string;
  quantityOrdered:  number;
  unitPrice?:       number | null;
  notes?:           string | null;
}

export interface CreatePoInput {
  vendorId?:             string | null;
  notes?:                string | null;
  expectedDeliveryDate?: string | null;
  items:                 PoItemInput[];
}

export interface UpdatePoInput {
  vendorId?:             string | null;
  notes?:                string | null;
  expectedDeliveryDate?: string | null;
  status?:               PoStatus;
}

// ─── po number generator ──────────────────────────────────────────────────────

async function nextPoNumber(): Promise<string> {
  const prefix = `PO-${new Date().getFullYear()}-`;
  const all = await db.select({ poNumber: purchaseOrders.poNumber })
    .from(purchaseOrders)
    .orderBy(desc(purchaseOrders.createdAt));

  const nums = all
    .filter((r) => r.poNumber.startsWith(prefix))
    .map((r) => parseInt(r.poNumber.slice(prefix.length), 10))
    .filter((n) => !isNaN(n));

  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

// ─── row → PO shape ───────────────────────────────────────────────────────────

type RawPoRow = {
  id: string; poNumber: string; status: string; notes: string | null;
  expectedDeliveryDate: string | null; deliveredAt: Date | null;
  createdAt: Date; updatedAt: Date; createdBy: string | null;
  vendorId: string | null; vendorName: string | null;
  itemId: string | null; itemProductId: string | null;
  itemProductName: string | null; itemProductSku: string | null;
  itemQtyOrdered: number | null; itemUnitPrice: number | null;
  itemTotalAmount: number | null; itemQtyReceived: number | null;
  itemDeliveredAt: Date | null; itemNotes: string | null;
};

function groupRows(rows: RawPoRow[]) {
  const poMap = new Map<string, ReturnType<typeof buildPoSummary>>();
  for (const row of rows) {
    if (!poMap.has(row.id)) poMap.set(row.id, buildPoSummary(row));
    if (row.itemId) {
      poMap.get(row.id)!.items.push({
        id:               row.itemId,
        productId:        row.itemProductId!,
        productName:      row.itemProductName ?? '—',
        productSku:       row.itemProductSku,
        quantityOrdered:  row.itemQtyOrdered!,
        unitPrice:        row.itemUnitPrice,
        totalAmount:      row.itemTotalAmount,
        quantityReceived: row.itemQtyReceived ?? 0,
        deliveredAt:      row.itemDeliveredAt,
        notes:            row.itemNotes,
      });
    }
  }
  return Array.from(poMap.values()).map(decoratePo);
}

function buildPoSummary(row: RawPoRow) {
  return {
    id:                   row.id,
    poNumber:             row.poNumber,
    status:               row.status as PoStatus,
    notes:                row.notes,
    expectedDeliveryDate: row.expectedDeliveryDate,
    deliveredAt:          row.deliveredAt,
    createdAt:            row.createdAt,
    updatedAt:            row.updatedAt,
    createdBy:            row.createdBy,
    vendorId:             row.vendorId,
    vendorName:           row.vendorName,
    items:                [] as {
      id: string; productId: string; productName: string; productSku: string | null;
      quantityOrdered: number; unitPrice: number | null; totalAmount: number | null;
      quantityReceived: number; deliveredAt: Date | null; notes: string | null;
    }[],
  };
}

function decoratePo<T extends ReturnType<typeof buildPoSummary>>(po: T) {
  const totalAmount = po.items.reduce((s, i) => s + (i.totalAmount ?? 0), 0);
  const itemCount   = po.items.length;
  const allDelivered = itemCount > 0 && po.items.every((i) => i.deliveredAt != null);
  return { ...po, totalAmount, itemCount, allDelivered };
}

// ─── shared select columns ────────────────────────────────────────────────────

const PO_SELECT = {
  id:                   purchaseOrders.id,
  poNumber:             purchaseOrders.poNumber,
  status:               purchaseOrders.status,
  notes:                purchaseOrders.notes,
  expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
  deliveredAt:          purchaseOrders.deliveredAt,
  createdAt:            purchaseOrders.createdAt,
  updatedAt:            purchaseOrders.updatedAt,
  createdBy:            purchaseOrders.createdBy,
  vendorId:             purchaseOrders.vendorId,
  vendorName:           vendors.companyName,
  itemId:               purchaseOrderItems.id,
  itemProductId:        purchaseOrderItems.productId,
  itemProductName:      products.name,
  itemProductSku:       products.sku,
  itemQtyOrdered:       purchaseOrderItems.quantityOrdered,
  itemUnitPrice:        purchaseOrderItems.unitPrice,
  itemTotalAmount:      purchaseOrderItems.totalAmount,
  itemQtyReceived:      purchaseOrderItems.quantityReceived,
  itemDeliveredAt:      purchaseOrderItems.deliveredAt,
  itemNotes:            purchaseOrderItems.notes,
} as const;

// ─── list ─────────────────────────────────────────────────────────────────────

export async function listPurchaseOrders(productId?: string) {
  if (productId) {
    const poIdRows = await db
      .select({ id: purchaseOrderItems.purchaseOrderId })
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.productId, productId));

    if (poIdRows.length === 0) return [];

    const ids = [...new Set(poIdRows.map((r) => r.id))];
    const rows = await db
      .select(PO_SELECT)
      .from(purchaseOrders)
      .leftJoin(vendors, eq(vendors.id, purchaseOrders.vendorId))
      .leftJoin(purchaseOrderItems, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
      .leftJoin(products, eq(products.id, purchaseOrderItems.productId))
      .where(inArray(purchaseOrders.id, ids))
      .orderBy(desc(purchaseOrders.createdAt));
    return groupRows(rows as unknown as RawPoRow[]);
  }

  const rows = await db
    .select(PO_SELECT)
    .from(purchaseOrders)
    .leftJoin(vendors, eq(vendors.id, purchaseOrders.vendorId))
    .leftJoin(purchaseOrderItems, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
    .leftJoin(products, eq(products.id, purchaseOrderItems.productId))
    .orderBy(desc(purchaseOrders.createdAt));
  return groupRows(rows as unknown as RawPoRow[]);
}

// ─── get by id ────────────────────────────────────────────────────────────────

export async function getPurchaseOrderById(id: string) {
  const rows = await db
    .select(PO_SELECT)
    .from(purchaseOrders)
    .leftJoin(vendors, eq(vendors.id, purchaseOrders.vendorId))
    .leftJoin(purchaseOrderItems, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
    .leftJoin(products, eq(products.id, purchaseOrderItems.productId))
    .where(eq(purchaseOrders.id, id))
    .orderBy(purchaseOrderItems.createdAt);

  if (rows.length === 0) throw new AppError('Purchase order not found', 404);
  const grouped = groupRows(rows as unknown as RawPoRow[]);
  return grouped[0];
}

// ─── create ───────────────────────────────────────────────────────────────────

export async function createPurchaseOrder(input: CreatePoInput, createdBy?: string) {
  if (!input.items || input.items.length === 0) {
    throw new AppError('At least one item is required', 400);
  }

  const poNumber = await nextPoNumber();

  const [po] = await db.insert(purchaseOrders).values({
    poNumber,
    vendorId:             input.vendorId ?? null,
    status:               'draft',
    notes:                input.notes ?? null,
    expectedDeliveryDate: input.expectedDeliveryDate ?? null,
    createdBy:            createdBy ?? null,
  }).returning();

  await db.insert(purchaseOrderItems).values(
    input.items.map((item) => ({
      purchaseOrderId: po.id,
      productId:       item.productId,
      quantityOrdered: item.quantityOrdered,
      unitPrice:       item.unitPrice ?? null,
      totalAmount:     item.unitPrice != null ? item.quantityOrdered * item.unitPrice : null,
      notes:           item.notes ?? null,
    }))
  );

  return getPurchaseOrderById(po.id);
}

// ─── update PO-level fields ───────────────────────────────────────────────────

export async function updatePurchaseOrder(id: string, input: UpdatePoInput, userId?: string) {
  const existing = await getPurchaseOrderById(id);

  if (input.status) {
    if (!validTransition(existing.status, input.status)) {
      throw new AppError(`Cannot transition from '${existing.status}' to '${input.status}'`, 400);
    }
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.vendorId            !== undefined) patch.vendorId            = input.vendorId;
  if (input.notes               !== undefined) patch.notes               = input.notes;
  if (input.expectedDeliveryDate !== undefined) patch.expectedDeliveryDate = input.expectedDeliveryDate;
  if (input.status              !== undefined) patch.status              = input.status;

  await db.update(purchaseOrders).set(patch).where(eq(purchaseOrders.id, id));

  if (input.status === 'delivered') {
    await deliverAllItems(id, userId);
  }

  return getPurchaseOrderById(id);
}

// ─── deliver single item ──────────────────────────────────────────────────────

export async function deliverItem(poId: string, itemId: string, userId?: string) {
  const po = await getPurchaseOrderById(poId);
  const item = po.items.find((i) => i.id === itemId);
  if (!item) throw new AppError('Item not found on this PO', 404);
  if (item.deliveredAt) throw new AppError('Item already delivered', 400);
  if (po.status === 'cancelled') throw new AppError('Cannot deliver items on a cancelled PO', 400);

  await processItemDelivery(po.id, item, userId);

  // If all items now delivered, mark PO as delivered too
  const updated = await getPurchaseOrderById(poId);
  if (updated.allDelivered && updated.status !== 'delivered') {
    await db.update(purchaseOrders)
      .set({ status: 'delivered', deliveredAt: new Date(), updatedAt: new Date() })
      .where(eq(purchaseOrders.id, poId));
  }

  return getPurchaseOrderById(poId);
}

// ─── cancel ───────────────────────────────────────────────────────────────────

export async function cancelPurchaseOrder(id: string) {
  const existing = await getPurchaseOrderById(id);
  if (existing.status === 'delivered') throw new AppError('Cannot cancel a delivered PO', 400);

  await db.update(purchaseOrders)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(purchaseOrders.id, id));

  return getPurchaseOrderById(id);
}

// ─── internal: process item delivery ─────────────────────────────────────────

async function processItemDelivery(
  poId: string,
  item: { id: string; productId: string; quantityOrdered: number; unitPrice: number | null; totalAmount: number | null },
  userId?: string,
) {
  const po = await db.select({ poNumber: purchaseOrders.poNumber })
    .from(purchaseOrders).where(eq(purchaseOrders.id, poId)).limit(1);
  const poNumber = po[0]?.poNumber ?? poId;

  // Mark item as delivered
  await db.update(purchaseOrderItems)
    .set({ deliveredAt: new Date(), quantityReceived: item.quantityOrdered })
    .where(eq(purchaseOrderItems.id, item.id));

  // Create stock batch
  const [batch] = await db.insert(stockBatches).values({
    productId:       item.productId,
    purchaseOrderId: poId,
    lotNumber:       `${poNumber}-${item.id.slice(0, 6)}`,
    quantity:        item.quantityOrdered,
    unitCost:        item.unitPrice,
    totalCost:       item.totalAmount,
    receivedAt:      new Date(),
    createdBy:       userId ?? null,
    notes:           `Auto-created from ${poNumber}`,
  }).returning();

  // Increment stock on hand
  await ensureStockRow(item.productId);
  const [current] = await db.select({ q: productStock.quantityOnHand })
    .from(productStock).where(eq(productStock.productId, item.productId)).limit(1);
  await db.update(productStock)
    .set({ quantityOnHand: (current?.q ?? 0) + item.quantityOrdered, updatedAt: new Date() })
    .where(eq(productStock.productId, item.productId));

  // Recalculate price
  const [pricingConfig] = await db.select().from(productPricing)
    .where(eq(productPricing.productId, item.productId)).limit(1);
  const method = (pricingConfig?.pricingMethod ?? 'weighted_average') as any;
  if (method !== 'manual') {
    await recalculatePrice(item.productId, method, batch.id, poId, userId);
  }
}

// ─── internal: deliver all pending items ─────────────────────────────────────

async function deliverAllItems(poId: string, userId?: string) {
  const po = await getPurchaseOrderById(poId);
  const pending = po.items.filter((i) => i.deliveredAt == null);

  for (const item of pending) {
    await processItemDelivery(poId, item, userId);
  }

  await db.update(purchaseOrders)
    .set({ deliveredAt: new Date(), updatedAt: new Date() })
    .where(eq(purchaseOrders.id, poId));
}

// ─── valid transitions ────────────────────────────────────────────────────────

function validTransition(from: PoStatus, to: PoStatus): boolean {
  const allowed: Record<PoStatus, PoStatus[]> = {
    draft:      ['confirmed', 'cancelled'],
    confirmed:  ['in_transit', 'cancelled'],
    in_transit: ['delivered', 'cancelled'],
    delivered:  [],
    cancelled:  [],
  };
  return allowed[from].includes(to);
}
