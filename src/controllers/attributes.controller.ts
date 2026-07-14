import { Response } from 'express';
import { z } from 'zod';
import {
  getAttributes, getAttributeById, createAttribute, updateAttribute, deleteAttribute,
} from '../services/attributes.service';
import { AppError } from '../lib/app-error';
import type { AuthRequest } from '../middleware/auth.middleware';

const dataTypeValues = ['string', 'number'] as const;

const createSchema = z.object({
  name:     z.string().min(1).max(255),
  unit:     z.string().max(50).optional(),
  dataType: z.enum(dataTypeValues).default('number'),
});

const updateSchema = createSchema.partial().refine(
  (d) => Object.keys(d).length > 0,
  { message: 'At least one field required' },
);

function handleError(res: Response, err: unknown, ctx: string): void {
  if (err instanceof AppError) { res.status(err.statusCode).json({ message: err.message }); return; }
  console.error(`[attributes.controller] ${ctx}:`, err);
  res.status(500).json({ message: 'Internal server error' });
}

export async function list(_req: AuthRequest, res: Response): Promise<void> {
  try { res.json(await getAttributes()); } catch (err) { handleError(res, err, 'list'); }
}

export async function getById(req: AuthRequest, res: Response): Promise<void> {
  try { res.json(await getAttributeById(req.params.id as string)); } catch (err) { handleError(res, err, 'getById'); }
}

export async function create(req: AuthRequest, res: Response): Promise<void> {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid body', errors: parsed.error.flatten() }); return; }
  try { res.status(201).json(await createAttribute(parsed.data)); } catch (err) { handleError(res, err, 'create'); }
}

export async function update(req: AuthRequest, res: Response): Promise<void> {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid body', errors: parsed.error.flatten() }); return; }
  try { res.json(await updateAttribute(req.params.id as string, parsed.data)); } catch (err) { handleError(res, err, 'update'); }
}

export async function remove(req: AuthRequest, res: Response): Promise<void> {
  try { await deleteAttribute(req.params.id as string); res.status(204).send(); } catch (err) { handleError(res, err, 'remove'); }
}
