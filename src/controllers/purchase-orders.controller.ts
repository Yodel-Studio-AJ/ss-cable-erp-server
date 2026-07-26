import { Response } from 'express';
import { z } from 'zod';
import {
  listPurchaseOrders, getPurchaseOrderById, createPurchaseOrder,
  updatePurchaseOrder, cancelPurchaseOrder, deliverItem,
} from '../services/purchase-orders.service';
import {
  getStock, setLowStockThreshold, getPricing, upsertPricingConfig, getStockBatches,
} from '../services/stock.service';
import { PO_STATUSES } from '../db/schema/inventory/purchase-orders';
import { PRICING_METHODS } from '../db/schema/inventory/product-pricing';
import { AppError } from '../lib/app-error';
import type { AuthRequest } from '../middleware/auth.middleware';

// ─── schemas ──────────────────────────────────────────────────────────────────

const poItemSchema = z.object({
  productId:       z.string().uuid(),
  quantityOrdered: z.number().positive(),
  unitPrice:       z.number().positive().nullable().optional(),
  notes:           z.string().nullable().optional(),
});

const createPoSchema = z.object({
  vendorId:             z.string().uuid().nullable().optional(),
  notes:                z.string().nullable().optional(),
  expectedDeliveryDate: z.string().nullable().optional(),
  items:                z.array(poItemSchema).min(1, 'At least one item required'),
});

const updatePoSchema = z.object({
  vendorId:             z.string().uuid().nullable().optional(),
  notes:                z.string().nullable().optional(),
  expectedDeliveryDate: z.string().nullable().optional(),
  status:               z.enum(PO_STATUSES).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });

const stockThresholdSchema = z.object({
  threshold: z.number().nullable(),
});

const pricingConfigSchema = z.object({
  pricingMethod: z.enum(PRICING_METHODS),
  manualPrice:   z.number().positive().nullable().optional(),
});

// ─── error handler ────────────────────────────────────────────────────────────

function handleError(res: Response, err: unknown, ctx: string): void {
  if (err instanceof AppError) { res.status(err.statusCode).json({ message: err.message }); return; }
  console.error(`[purchase-orders.controller] ${ctx}:`, err);
  res.status(500).json({ message: 'Internal server error' });
}

// ─── purchase order handlers ──────────────────────────────────────────────────

function userId(req: AuthRequest): string | undefined { return req.user?.sub; }
function paramStr(req: AuthRequest, key: string): string { return req.params[key] as string; }

export async function listHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const productId = req.query.productId as string | undefined;
    res.json(await listPurchaseOrders(productId));
  } catch (err) { handleError(res, err, 'list'); }
}

export async function getByIdHandler(req: AuthRequest, res: Response): Promise<void> {
  try { res.json(await getPurchaseOrderById(paramStr(req, 'id'))); }
  catch (err) { handleError(res, err, 'getById'); }
}

export async function createHandler(req: AuthRequest, res: Response): Promise<void> {
  const parsed = createPoSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid body', errors: parsed.error.flatten() }); return; }
  try {
    res.status(201).json(await createPurchaseOrder(parsed.data, userId(req)));
  } catch (err) { handleError(res, err, 'create'); }
}

export async function updateHandler(req: AuthRequest, res: Response): Promise<void> {
  const parsed = updatePoSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid body', errors: parsed.error.flatten() }); return; }
  try {
    res.json(await updatePurchaseOrder(paramStr(req, 'id'), parsed.data, userId(req)));
  } catch (err) { handleError(res, err, 'update'); }
}

export async function cancelHandler(req: AuthRequest, res: Response): Promise<void> {
  try { res.json(await cancelPurchaseOrder(paramStr(req, 'id'))); }
  catch (err) { handleError(res, err, 'cancel'); }
}

export async function deliverItemHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json(await deliverItem(paramStr(req, 'id'), paramStr(req, 'itemId'), userId(req)));
  } catch (err) { handleError(res, err, 'deliverItem'); }
}

// ─── stock handlers ───────────────────────────────────────────────────────────

export async function getStockHandler(req: AuthRequest, res: Response): Promise<void> {
  try { res.json(await getStock(paramStr(req, 'productId'))); }
  catch (err) { handleError(res, err, 'getStock'); }
}

export async function setThresholdHandler(req: AuthRequest, res: Response): Promise<void> {
  const parsed = stockThresholdSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid body', errors: parsed.error.flatten() }); return; }
  try { res.json(await setLowStockThreshold(paramStr(req, 'productId'), parsed.data.threshold)); }
  catch (err) { handleError(res, err, 'setThreshold'); }
}

export async function getBatchesHandler(req: AuthRequest, res: Response): Promise<void> {
  try { res.json(await getStockBatches(paramStr(req, 'productId'))); }
  catch (err) { handleError(res, err, 'getBatches'); }
}

// ─── pricing handlers ─────────────────────────────────────────────────────────

export async function getPricingHandler(req: AuthRequest, res: Response): Promise<void> {
  try { res.json(await getPricing(paramStr(req, 'productId'))); }
  catch (err) { handleError(res, err, 'getPricing'); }
}

export async function upsertPricingHandler(req: AuthRequest, res: Response): Promise<void> {
  const parsed = pricingConfigSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid body', errors: parsed.error.flatten() }); return; }
  try {
    const newPrice = await upsertPricingConfig(
      paramStr(req, 'productId'),
      parsed.data.pricingMethod,
      parsed.data.manualPrice,
      userId(req),
    );
    res.json({ currentPrice: newPrice });
  } catch (err) { handleError(res, err, 'upsertPricing'); }
}
