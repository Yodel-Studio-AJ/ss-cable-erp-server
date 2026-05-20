import { Request, Response } from 'express';
import { z } from 'zod';
import {
  loginUser,
  registerOwner,
  refreshAccessToken,
  getMe,
  changePassword,
  AuthError,
} from '../services/auth.service';
import { AuthRequest } from '../middleware/auth.middleware';

// ─── schemas ──────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phoneNumber: z.string().min(7),
  password: z.string().min(8),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

// ─── shared error handler ─────────────────────────────────────────────────────

function handleError(res: Response, err: unknown, context: string): void {
  if (err instanceof AuthError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }
  console.error(`[auth.controller] ${context} error:`, err);
  res.status(500).json({ message: 'Internal server error' });
}

// ─── handlers ─────────────────────────────────────────────────────────────────

export async function login(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() });
    return;
  }
  try {
    res.json(await loginUser(parsed.data));
  } catch (err) {
    handleError(res, err, 'login');
  }
}

export async function register(req: Request, res: Response): Promise<void> {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() });
    return;
  }
  try {
    res.status(201).json(await registerOwner(parsed.data));
  } catch (err) {
    handleError(res, err, 'register');
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'refreshToken is required' });
    return;
  }
  try {
    res.json(await refreshAccessToken(parsed.data.refreshToken));
  } catch (err) {
    handleError(res, err, 'refresh');
  }
}

export function logout(_req: Request, res: Response): void {
  // stateless — client discards tokens; no server-side action needed
  res.status(204).send();
}

export async function me(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json(await getMe(req.user!.sub));
  } catch (err) {
    handleError(res, err, 'me');
  }
}

export async function updatePassword(req: AuthRequest, res: Response): Promise<void> {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() });
    return;
  }
  try {
    await changePassword(req.user!.sub, parsed.data);
    res.status(204).send();
  } catch (err) {
    handleError(res, err, 'updatePassword');
  }
}
