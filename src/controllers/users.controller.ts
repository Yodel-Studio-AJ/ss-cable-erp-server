import { Response } from 'express';
import { z } from 'zod';
import { getUsers, getUserById, createUser, updateUser, deleteUser, AppError } from '../services/users.service';
import type { AuthRequest } from '../middleware/auth.middleware';

// ─── schemas ──────────────────────────────────────────────────────────────────

const roleEnum = z.enum(['owner', 'admin', 'floor_manager', 'member']);

const createSchema = z.object({
  name:        z.string().min(1),
  email:       z.string().email(),
  phoneNumber: z.string().min(7),
  password:    z.string().min(8),
  role:        roleEnum,
});

const updateSchema = z.object({
  name:        z.string().min(1).optional(),
  email:       z.string().email().optional(),
  phoneNumber: z.string().min(7).optional(),
  role:        roleEnum.optional(),
  isActive:    z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });

// ─── error handler ────────────────────────────────────────────────────────────

function handleError(res: Response, err: unknown, ctx: string): void {
  if (err instanceof AppError) { res.status(err.statusCode).json({ message: err.message }); return; }
  console.error(`[users.controller] ${ctx}:`, err);
  res.status(500).json({ message: 'Internal server error' });
}

// ─── handlers ─────────────────────────────────────────────────────────────────

export async function list(req: AuthRequest, res: Response): Promise<void> {
  try { res.json(await getUsers(req.user!)); } catch (err) { handleError(res, err, 'list'); }
}

export async function getById(req: AuthRequest, res: Response): Promise<void> {
  try { res.json(await getUserById(req.params.id as string, req.user!)); } catch (err) { handleError(res, err, 'getById'); }
}

export async function create(req: AuthRequest, res: Response): Promise<void> {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() }); return; }
  try { res.status(201).json(await createUser(parsed.data, req.user!)); } catch (err) { handleError(res, err, 'create'); }
}

export async function update(req: AuthRequest, res: Response): Promise<void> {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() }); return; }
  try { res.json(await updateUser(req.params.id as string, parsed.data, req.user!)); } catch (err) { handleError(res, err, 'update'); }
}

export async function remove(req: AuthRequest, res: Response): Promise<void> {
  try { await deleteUser(req.params.id as string); res.status(204).send(); } catch (err) { handleError(res, err, 'remove'); }
}
