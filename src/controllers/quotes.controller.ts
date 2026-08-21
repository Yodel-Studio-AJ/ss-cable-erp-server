import { Response } from 'express';
import { z } from 'zod';
import {
  listQuotes, getQuoteById, createQuote, updateQuote, addQuoteItem, removeQuoteItem,
} from '../services/quotes.service';
import { QUOTE_STATUSES } from '../db/schema/sales/quotes';
import { AppError } from '../lib/app-error';
import type { AuthRequest } from '../middleware/auth.middleware';

// ─── schemas ──────────────────────────────────────────────────────────────────

const quoteItemSchema = z.object({
  productId:   z.string().uuid(),
  displayName: z.string().max(255).nullable().optional(),
  quantity:    z.number().positive(),
  unitPrice:   z.number().positive().nullable().optional(),
  notes:       z.string().nullable().optional(),
});

const createQuoteSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  notes:      z.string().nullable().optional(),
  validUntil: z.string().nullable().optional(),
  items:      z.array(quoteItemSchema).min(1, 'At least one item required'),
});

const updateQuoteSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  notes:      z.string().nullable().optional(),
  validUntil: z.string().nullable().optional(),
  status:     z.enum(QUOTE_STATUSES).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });

// ─── error handler ────────────────────────────────────────────────────────────

function handleError(res: Response, err: unknown, ctx: string): void {
  if (err instanceof AppError) { res.status(err.statusCode).json({ message: err.message }); return; }
  console.error(`[quotes.controller] ${ctx}:`, err);
  res.status(500).json({ message: 'Internal server error' });
}

function paramStr(req: AuthRequest, key: string): string { return req.params[key] as string; }

// ─── handlers ─────────────────────────────────────────────────────────────────

export async function listHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const customerId = req.query.customerId as string | undefined;
    res.json(await listQuotes(customerId));
  } catch (err) { handleError(res, err, 'list'); }
}

export async function getByIdHandler(req: AuthRequest, res: Response): Promise<void> {
  try { res.json(await getQuoteById(paramStr(req, 'id'))); }
  catch (err) { handleError(res, err, 'getById'); }
}

export async function createHandler(req: AuthRequest, res: Response): Promise<void> {
  const parsed = createQuoteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid body', errors: parsed.error.flatten() }); return; }
  try {
    res.status(201).json(await createQuote(parsed.data, req.user?.sub));
  } catch (err) { handleError(res, err, 'create'); }
}

export async function updateHandler(req: AuthRequest, res: Response): Promise<void> {
  const parsed = updateQuoteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid body', errors: parsed.error.flatten() }); return; }
  try {
    res.json(await updateQuote(paramStr(req, 'id'), parsed.data));
  } catch (err) { handleError(res, err, 'update'); }
}

export async function addItemHandler(req: AuthRequest, res: Response): Promise<void> {
  const parsed = quoteItemSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid body', errors: parsed.error.flatten() }); return; }
  try {
    res.status(201).json(await addQuoteItem(paramStr(req, 'id'), parsed.data));
  } catch (err) { handleError(res, err, 'addItem'); }
}

export async function removeItemHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json(await removeQuoteItem(paramStr(req, 'id'), paramStr(req, 'itemId')));
  } catch (err) { handleError(res, err, 'removeItem'); }
}
