import { Response } from 'express';
import { z } from 'zod';
import {
  getVendors, getVendorById, createVendor, updateVendor, deleteVendor,
  setVendorProductGroups, setVendorBranches,
} from '../services/vendors.service';
import { AppError } from '../lib/app-error';
import type { AuthRequest } from '../middleware/auth.middleware';

// ─── schemas ──────────────────────────────────────────────────────────────────

const vendorTypeValues = ['manufacturer', 'distributor', 'wholesaler', 'trader'] as const;

const createSchema = z.object({
  companyName:         z.string().min(1),
  vendorType:          z.enum(vendorTypeValues).default('trader'),
  specialization:      z.string().optional(),
  gstin:               z.string().optional(),
  address:             z.string().optional(),
  city:                z.string().optional(),
  state:               z.string().optional(),
  pincode:             z.string().optional(),
  contactName:         z.string().min(1),
  contactPhone:        z.string().optional(),
  contactEmail:        z.string().email().optional(),
  contactDesignation:  z.string().optional(),
});

const updateSchema = createSchema.partial().refine(
  (d) => Object.keys(d).length > 0,
  { message: 'At least one field required' },
);

const setProductGroupsSchema = z.object({
  productGroupIds: z.array(z.string().uuid()),
});

const setBranchesSchema = z.object({
  branchIds: z.array(z.string().uuid()),
});

// ─── error handler ────────────────────────────────────────────────────────────

function handleError(res: Response, err: unknown, ctx: string): void {
  if (err instanceof AppError) { res.status(err.statusCode).json({ message: err.message }); return; }
  console.error(`[vendors.controller] ${ctx}:`, err);
  res.status(500).json({ message: 'Internal server error' });
}

// ─── handlers ─────────────────────────────────────────────────────────────────

export async function list(_req: AuthRequest, res: Response): Promise<void> {
  try { res.json(await getVendors()); } catch (err) { handleError(res, err, 'list'); }
}

export async function getById(req: AuthRequest, res: Response): Promise<void> {
  try { res.json(await getVendorById(req.params.id as string)); } catch (err) { handleError(res, err, 'getById'); }
}

export async function create(req: AuthRequest, res: Response): Promise<void> {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() }); return; }
  try { res.status(201).json(await createVendor(parsed.data, req.user!)); } catch (err) { handleError(res, err, 'create'); }
}

export async function update(req: AuthRequest, res: Response): Promise<void> {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() }); return; }
  try { res.json(await updateVendor(req.params.id as string, parsed.data)); } catch (err) { handleError(res, err, 'update'); }
}

export async function remove(req: AuthRequest, res: Response): Promise<void> {
  try { await deleteVendor(req.params.id as string); res.status(204).send(); } catch (err) { handleError(res, err, 'remove'); }
}

export async function updateProductGroups(req: AuthRequest, res: Response): Promise<void> {
  const parsed = setProductGroupsSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'productGroupIds must be an array of UUIDs' }); return; }
  try { res.json(await setVendorProductGroups(req.params.id as string, parsed.data.productGroupIds)); } catch (err) { handleError(res, err, 'updateProductGroups'); }
}

export async function updateBranches(req: AuthRequest, res: Response): Promise<void> {
  const parsed = setBranchesSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'branchIds must be an array of UUIDs' }); return; }
  try { res.json(await setVendorBranches(req.params.id as string, parsed.data.branchIds)); } catch (err) { handleError(res, err, 'updateBranches'); }
}
