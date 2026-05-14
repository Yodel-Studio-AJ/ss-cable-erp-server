import { Request, Response } from 'express';
import { z } from 'zod';
import { loginUser, AuthError } from '../services/auth.service';

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

export async function login(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() });
    return;
  }

  try {
    const result = await loginUser(parsed.data);
    res.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    console.error('[auth.controller] login error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}
