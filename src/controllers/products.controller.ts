import { Response } from 'express';
import { z } from 'zod';
import {
  listAllProducts, listProducts, getProductById, createProduct, updateProduct, deleteProduct,
} from '../services/products.service';
import { AppError } from '../lib/app-error';
import type { AuthRequest } from '../middleware/auth.middleware';

// ─── schemas ──────────────────────────────────────────────────────────────────

const attrValueSchema = z.object({
  productGroupAttributeId: z.string().uuid(),
  numericValue:            z.number().nullable().optional(),
  textValue:               z.string().max(500).nullable().optional(),
});

const createSchema = z.object({
  name:            z.string().min(1).max(255),
  sku:             z.string().max(100).nullable().optional(),
  description:     z.string().nullable().optional(),
  attributeValues: z.array(attrValueSchema).default([]),
});

const updateSchema = createSchema.partial().refine(
  (d) => Object.keys(d).length > 0,
  { message: 'At least one field required' },
);

// ─── error handler ────────────────────────────────────────────────────────────

function handleError(res: Response, err: unknown, ctx: string): void {
  if (err instanceof AppError) { res.status(err.statusCode).json({ message: err.message }); return; }
  console.error(`[products.controller] ${ctx}:`, err);
  res.status(500).json({ message: 'Internal server error' });
}

// ─── handlers ─────────────────────────────────────────────────────────────────

export async function listAllHandler(_req: AuthRequest, res: Response): Promise<void> {
  try { res.json(await listAllProducts()); }
  catch (err) { handleError(res, err, 'listAll'); }
}

export async function listHandler(req: AuthRequest, res: Response): Promise<void> {
  try { res.json(await listProducts(req.params.id as string)); }
  catch (err) { handleError(res, err, 'list'); }
}

export async function getByIdHandler(req: AuthRequest, res: Response): Promise<void> {
  try { res.json(await getProductById(req.params.id as string, req.params.productId as string)); }
  catch (err) { handleError(res, err, 'getById'); }
}

export async function createHandler(req: AuthRequest, res: Response): Promise<void> {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() }); return; }
  try { res.status(201).json(await createProduct(req.params.id as string, parsed.data)); }
  catch (err) { handleError(res, err, 'create'); }
}

export async function updateHandler(req: AuthRequest, res: Response): Promise<void> {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() }); return; }
  try { res.json(await updateProduct(req.params.id as string, req.params.productId as string, parsed.data)); }
  catch (err) { handleError(res, err, 'update'); }
}

export async function removeHandler(req: AuthRequest, res: Response): Promise<void> {
  try { await deleteProduct(req.params.id as string, req.params.productId as string); res.status(204).send(); }
  catch (err) { handleError(res, err, 'remove'); }
}
