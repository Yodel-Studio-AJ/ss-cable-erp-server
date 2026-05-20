import { Response } from 'express';
import { z } from 'zod';
import {
  getProductGroups, getProductGroupById, createProductGroup, updateProductGroup, deleteProductGroup,
} from '../services/product-groups.service';
import { AppError } from '../lib/app-error';
import type { AuthRequest } from '../middleware/auth.middleware';

// ─── schemas ──────────────────────────────────────────────────────────────────

const productGroupTypeEnum = z.enum(['raw_material', 'intermediate', 'finished_goods', 'processed_product']);
const materialTypeEnum     = z.enum(['metal', 'pvc', 'mixed']);

const createSchema = z.object({
  name:         z.string().min(1),
  type:         productGroupTypeEnum,
  isProcured:   z.boolean(),
  materialType: materialTypeEnum,
});

const updateSchema = createSchema.partial().refine(
  (d) => Object.keys(d).length > 0,
  { message: 'At least one field required' },
);

// ─── error handler ────────────────────────────────────────────────────────────

function handleError(res: Response, err: unknown, ctx: string): void {
  if (err instanceof AppError) { res.status(err.statusCode).json({ message: err.message }); return; }
  console.error(`[product-groups.controller] ${ctx}:`, err);
  res.status(500).json({ message: 'Internal server error' });
}

// ─── handlers ─────────────────────────────────────────────────────────────────

export async function list(_req: AuthRequest, res: Response): Promise<void> {
  try { res.json(await getProductGroups()); } catch (err) { handleError(res, err, 'list'); }
}

export async function getById(req: AuthRequest, res: Response): Promise<void> {
  try { res.json(await getProductGroupById(req.params.id as string)); } catch (err) { handleError(res, err, 'getById'); }
}

export async function create(req: AuthRequest, res: Response): Promise<void> {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() }); return; }
  try { res.status(201).json(await createProductGroup(parsed.data)); } catch (err) { handleError(res, err, 'create'); }
}

export async function update(req: AuthRequest, res: Response): Promise<void> {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() }); return; }
  try { res.json(await updateProductGroup(req.params.id as string, parsed.data)); } catch (err) { handleError(res, err, 'update'); }
}

export async function remove(req: AuthRequest, res: Response): Promise<void> {
  try { await deleteProductGroup(req.params.id as string); res.status(204).send(); } catch (err) { handleError(res, err, 'remove'); }
}
