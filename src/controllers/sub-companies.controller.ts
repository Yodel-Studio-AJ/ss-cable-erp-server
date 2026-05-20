import { Response } from 'express';
import { z } from 'zod';
import {
  getSubCompanies, getSubCompanyById, createSubCompany, updateSubCompany, deleteSubCompany,
  getSubCompanyUsers, addUserToSubCompany, updateSubCompanyMembership, removeUserFromSubCompany,
} from '../services/sub-companies.service';
import { AppError } from '../lib/app-error';
import type { AuthRequest } from '../middleware/auth.middleware';

// ─── schemas ──────────────────────────────────────────────────────────────────

const createSchema = z.object({
  name:    z.string().min(1),
  address: z.string().optional(),
  city:    z.string().optional(),
  phone:   z.string().optional(),
});

const updateSchema = createSchema.partial().refine(
  (d) => Object.keys(d).length > 0,
  { message: 'At least one field required' },
);

const addUserSchema = z.object({
  userId:    z.string().uuid(),
  isPrimary: z.boolean().default(false),
});

const updateMembershipSchema = z.object({
  isPrimary: z.boolean(),
});

// ─── error handler ────────────────────────────────────────────────────────────

function handleError(res: Response, err: unknown, ctx: string): void {
  if (err instanceof AppError) { res.status(err.statusCode).json({ message: err.message }); return; }
  console.error(`[sub-companies.controller] ${ctx}:`, err);
  res.status(500).json({ message: 'Internal server error' });
}

// ─── handlers ─────────────────────────────────────────────────────────────────

export async function list(req: AuthRequest, res: Response): Promise<void> {
  try { res.json(await getSubCompanies(req.user!)); } catch (err) { handleError(res, err, 'list'); }
}

export async function getById(req: AuthRequest, res: Response): Promise<void> {
  try { res.json(await getSubCompanyById(req.params.id as string, req.user!)); } catch (err) { handleError(res, err, 'getById'); }
}

export async function create(req: AuthRequest, res: Response): Promise<void> {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() }); return; }
  try { res.status(201).json(await createSubCompany(parsed.data)); } catch (err) { handleError(res, err, 'create'); }
}

export async function update(req: AuthRequest, res: Response): Promise<void> {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() }); return; }
  try { res.json(await updateSubCompany(req.params.id as string, parsed.data)); } catch (err) { handleError(res, err, 'update'); }
}

export async function remove(req: AuthRequest, res: Response): Promise<void> {
  try { await deleteSubCompany(req.params.id as string); res.status(204).send(); } catch (err) { handleError(res, err, 'remove'); }
}

export async function listUsers(req: AuthRequest, res: Response): Promise<void> {
  try { res.json(await getSubCompanyUsers(req.params.id as string)); } catch (err) { handleError(res, err, 'listUsers'); }
}

export async function addUser(req: AuthRequest, res: Response): Promise<void> {
  const parsed = addUserSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() }); return; }
  try { res.status(201).json(await addUserToSubCompany(req.params.id as string, parsed.data)); } catch (err) { handleError(res, err, 'addUser'); }
}

export async function updateMembership(req: AuthRequest, res: Response): Promise<void> {
  const parsed = updateMembershipSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'isPrimary (boolean) is required' }); return; }
  try { res.json(await updateSubCompanyMembership(req.params.id as string, req.params.userId as string, parsed.data.isPrimary)); } catch (err) { handleError(res, err, 'updateMembership'); }
}

export async function removeUser(req: AuthRequest, res: Response): Promise<void> {
  try { await removeUserFromSubCompany(req.params.id as string, req.params.userId as string); res.status(204).send(); } catch (err) { handleError(res, err, 'removeUser'); }
}
