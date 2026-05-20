import { Response } from 'express';
import { z } from 'zod';
import {
  getCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer,
  getContacts, addContact, updateContact, deleteContact,
} from '../services/customers.service';
import { AppError } from '../lib/app-error';
import type { AuthRequest } from '../middleware/auth.middleware';

// ─── schemas ──────────────────────────────────────────────────────────────────

const customerCreateSchema = z.object({
  companyName: z.string().min(1),
  industry:    z.string().optional(),
  gstin:       z.string().optional(),
  address:     z.string().optional(),
  city:        z.string().optional(),
  state:       z.string().optional(),
  pincode:     z.string().optional(),
  notes:       z.string().optional(),
});

const customerUpdateSchema = customerCreateSchema.partial().refine(
  (d) => Object.keys(d).length > 0,
  { message: 'At least one field required' },
);

const contactCreateSchema = z.object({
  name:        z.string().min(1),
  phone:       z.string().optional(),
  email:       z.string().email().optional(),
  designation: z.string().optional(),
  isPrimary:   z.boolean().default(false),
});

const contactUpdateSchema = contactCreateSchema.partial().refine(
  (d) => Object.keys(d).length > 0,
  { message: 'At least one field required' },
);

// ─── error handler ────────────────────────────────────────────────────────────

function handleError(res: Response, err: unknown, ctx: string): void {
  if (err instanceof AppError) { res.status(err.statusCode).json({ message: err.message }); return; }
  console.error(`[customers.controller] ${ctx}:`, err);
  res.status(500).json({ message: 'Internal server error' });
}

// ─── customer handlers ────────────────────────────────────────────────────────

export async function list(_req: AuthRequest, res: Response): Promise<void> {
  try { res.json(await getCustomers()); } catch (err) { handleError(res, err, 'list'); }
}

export async function getById(req: AuthRequest, res: Response): Promise<void> {
  try { res.json(await getCustomerById(req.params.id)); } catch (err) { handleError(res, err, 'getById'); }
}

export async function create(req: AuthRequest, res: Response): Promise<void> {
  const parsed = customerCreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() }); return; }
  try { res.status(201).json(await createCustomer(parsed.data, req.user!)); } catch (err) { handleError(res, err, 'create'); }
}

export async function update(req: AuthRequest, res: Response): Promise<void> {
  const parsed = customerUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() }); return; }
  try { res.json(await updateCustomer(req.params.id, parsed.data)); } catch (err) { handleError(res, err, 'update'); }
}

export async function remove(req: AuthRequest, res: Response): Promise<void> {
  try { await deleteCustomer(req.params.id); res.status(204).send(); } catch (err) { handleError(res, err, 'remove'); }
}

// ─── contact handlers ─────────────────────────────────────────────────────────

export async function listContacts(req: AuthRequest, res: Response): Promise<void> {
  try { res.json(await getContacts(req.params.id)); } catch (err) { handleError(res, err, 'listContacts'); }
}

export async function createContact(req: AuthRequest, res: Response): Promise<void> {
  const parsed = contactCreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() }); return; }
  try { res.status(201).json(await addContact(req.params.id, parsed.data)); } catch (err) { handleError(res, err, 'createContact'); }
}

export async function updateContactHandler(req: AuthRequest, res: Response): Promise<void> {
  const parsed = contactUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() }); return; }
  try { res.json(await updateContact(req.params.contactId, parsed.data)); } catch (err) { handleError(res, err, 'updateContact'); }
}

export async function removeContact(req: AuthRequest, res: Response): Promise<void> {
  try { await deleteContact(req.params.contactId); res.status(204).send(); } catch (err) { handleError(res, err, 'removeContact'); }
}
