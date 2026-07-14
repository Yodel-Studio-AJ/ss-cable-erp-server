import { Response } from 'express';
import { z } from 'zod';
import {
  getProductGroups, getProductGroupById, createProductGroup, updateProductGroup, deleteProductGroup,
  getGroupAttributes, addGroupAttribute, updateGroupAttribute, removeGroupAttribute, reorderGroupAttributes,
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

// ─── group-attribute schemas ──────────────────────────────────────────────────

const addGroupAttrSchema = z.object({
  attributeId:     z.string().uuid(),
  formulaAlias:    z.string().max(50).optional(),
  isCalculated:    z.boolean().default(false),
  formula:         z.string().optional(),
  isQuantityBasis: z.boolean().default(false),
  sortOrder:       z.number().int().default(0),
});

const updateGroupAttrSchema = z.object({
  formulaAlias:    z.string().max(50).nullable().optional(),
  isCalculated:    z.boolean().optional(),
  formula:         z.string().nullable().optional(),
  isQuantityBasis: z.boolean().optional(),
  sortOrder:       z.number().int().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });

const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()),
});

// ─── group-attribute handlers ─────────────────────────────────────────────────

export async function listGroupAttrs(req: AuthRequest, res: Response): Promise<void> {
  try { res.json(await getGroupAttributes(req.params.id as string)); } catch (err) { handleError(res, err, 'listGroupAttrs'); }
}

export async function addGroupAttr(req: AuthRequest, res: Response): Promise<void> {
  const parsed = addGroupAttrSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid body', errors: parsed.error.flatten() }); return; }
  try { res.status(201).json(await addGroupAttribute(req.params.id as string, parsed.data)); } catch (err) { handleError(res, err, 'addGroupAttr'); }
}

export async function updateGroupAttr(req: AuthRequest, res: Response): Promise<void> {
  const parsed = updateGroupAttrSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid body', errors: parsed.error.flatten() }); return; }
  try { res.json(await updateGroupAttribute(req.params.id as string, req.params.pgaId as string, parsed.data)); } catch (err) { handleError(res, err, 'updateGroupAttr'); }
}

export async function removeGroupAttr(req: AuthRequest, res: Response): Promise<void> {
  try { await removeGroupAttribute(req.params.id as string, req.params.pgaId as string); res.status(204).send(); } catch (err) { handleError(res, err, 'removeGroupAttr'); }
}

export async function reorderGroupAttrs(req: AuthRequest, res: Response): Promise<void> {
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'orderedIds must be an array of UUIDs' }); return; }
  try { res.json(await reorderGroupAttributes(req.params.id as string, parsed.data.orderedIds)); } catch (err) { handleError(res, err, 'reorderGroupAttrs'); }
}
