import { eq, desc, asc } from 'drizzle-orm';
import { db } from '../db/connection';
import {
  productStock, productPricing, productPriceHistory, stockBatches,
} from '../db/schema';
import type { PricingMethod } from '../db/schema/inventory/product-pricing';
import { AppError } from '../lib/app-error';

// ─── ensure stock row ─────────────────────────────────────────────────────────

export async function ensureStockRow(productId: string) {
  const existing = await db.select().from(productStock)
    .where(eq(productStock.productId, productId)).limit(1);
  if (existing.length > 0) return existing[0];
  const [row] = await db.insert(productStock).values({ productId }).returning();
  return row;
}

// ─── get stock ────────────────────────────────────────────────────────────────

export async function getStock(productId: string) {
  const [row] = await db.select().from(productStock)
    .where(eq(productStock.productId, productId)).limit(1);
  return row ?? { productId, quantityOnHand: 0, lowStockThreshold: null };
}

// ─── set low stock threshold ──────────────────────────────────────────────────

export async function setLowStockThreshold(productId: string, threshold: number | null) {
  await ensureStockRow(productId);
  const [updated] = await db.update(productStock)
    .set({ lowStockThreshold: threshold, updatedAt: new Date() })
    .where(eq(productStock.productId, productId))
    .returning();
  return updated;
}

// ─── recalculate price from batches ──────────────────────────────────────────

export async function recalculatePrice(
  productId: string,
  method: PricingMethod,
  triggerBatchId?: string,
  triggerPoId?: string,
  createdBy?: string,
): Promise<number | null> {
  if (method === 'manual') return null;

  const batches = await db.select({
    unitCost:   stockBatches.unitCost,
    quantity:   stockBatches.quantity,
    receivedAt: stockBatches.receivedAt,
  })
    .from(stockBatches)
    .where(eq(stockBatches.productId, productId))
    .orderBy(asc(stockBatches.receivedAt));

  const withCost = batches.filter((b) => b.unitCost != null);
  if (withCost.length === 0) return null;

  let newPrice: number;

  switch (method) {
    case 'weighted_average': {
      const totalQty  = withCost.reduce((s, b) => s + b.quantity, 0);
      const totalCost = withCost.reduce((s, b) => s + b.quantity * b.unitCost!, 0);
      newPrice = totalQty > 0 ? totalCost / totalQty : withCost[withCost.length - 1].unitCost!;
      break;
    }
    case 'average_all': {
      newPrice = withCost.reduce((s, b) => s + b.unitCost!, 0) / withCost.length;
      break;
    }
    case 'latest_lot': {
      newPrice = withCost[withCost.length - 1].unitCost!;
      break;
    }
    case 'oldest_lot': {
      newPrice = withCost[0].unitCost!;
      break;
    }
    default:
      return null;
  }

  // Get unit cost of the trigger batch for the log
  let lotUnitCost: number | null = null;
  if (triggerBatchId) {
    const [b] = await db.select({ unitCost: stockBatches.unitCost })
      .from(stockBatches).where(eq(stockBatches.id, triggerBatchId)).limit(1);
    lotUnitCost = b?.unitCost ?? null;
  }

  // Upsert pricing row (may not exist yet if never configured)
  await db
    .insert(productPricing)
    .values({ productId, pricingMethod: method, currentPrice: newPrice })
    .onConflictDoUpdate({
      target: productPricing.productId,
      set:    { currentPrice: newPrice, updatedAt: new Date() },
    });

  // Log the change
  await db.insert(productPriceHistory).values({
    productId,
    price:           newPrice,
    pricingMethod:   method,
    stockBatchId:    triggerBatchId ?? null,
    purchaseOrderId: triggerPoId ?? null,
    lotUnitCost,
    createdBy:       createdBy ?? null,
  });

  return newPrice;
}

// ─── get pricing config + history ─────────────────────────────────────────────

export async function getPricing(productId: string) {
  const [config] = await db.select().from(productPricing)
    .where(eq(productPricing.productId, productId)).limit(1);
  const history = await db.select().from(productPriceHistory)
    .where(eq(productPriceHistory.productId, productId))
    .orderBy(desc(productPriceHistory.createdAt))
    .limit(50);
  return { config: config ?? null, history };
}

// ─── upsert pricing config ────────────────────────────────────────────────────

export async function upsertPricingConfig(
  productId: string,
  method: PricingMethod,
  manualPrice?: number | null,
  createdBy?: string,
) {
  const existing = await db.select().from(productPricing)
    .where(eq(productPricing.productId, productId)).limit(1);

  if (existing.length === 0) {
    await db.insert(productPricing).values({
      productId,
      pricingMethod: method,
      currentPrice:  manualPrice ?? null,
    });
  } else {
    await db.update(productPricing)
      .set({ pricingMethod: method, updatedAt: new Date() })
      .where(eq(productPricing.productId, productId));
  }

  if (method === 'manual' && manualPrice != null) {
    await db
      .insert(productPricing)
      .values({ productId, pricingMethod: 'manual', currentPrice: manualPrice })
      .onConflictDoUpdate({
        target: productPricing.productId,
        set:    { currentPrice: manualPrice, pricingMethod: 'manual', updatedAt: new Date() },
      });
    await db.insert(productPriceHistory).values({
      productId,
      price:         manualPrice,
      pricingMethod: 'manual',
      createdBy:     createdBy ?? null,
      notes:         'Manual price update',
    });
    return manualPrice;
  }

  // Recalculate with the new method
  return recalculatePrice(productId, method, undefined, undefined, createdBy);
}

// ─── get stock batches ────────────────────────────────────────────────────────

export async function getStockBatches(productId: string) {
  return db.select().from(stockBatches)
    .where(eq(stockBatches.productId, productId))
    .orderBy(desc(stockBatches.receivedAt));
}
