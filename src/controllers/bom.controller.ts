import { Response } from 'express';
import { z } from 'zod';
import { calculateBom, getBomInputsForProduct } from '../services/bom.service';
import { AppError } from '../lib/app-error';
import type { AuthRequest } from '../middleware/auth.middleware';

function handleError(res: Response, err: unknown, ctx: string): void {
  if (err instanceof AppError) { res.status(err.statusCode).json({ message: err.message }); return; }
  console.error(`[bom.controller] ${ctx}:`, err);
  res.status(500).json({ message: 'Internal server error' });
}

const calculateSchema = z.object({
  outputProductId: z.string().uuid(),
  outputQty:       z.number().positive(),
  // inputs may be empty — the service auto-loads saved variant inputs from product_variant_inputs
  inputs: z.array(z.object({
    bomInputId:     z.string().uuid(),
    inputProductId: z.string().uuid(),
  })).default([]),
});

export async function calculateHandler(req: AuthRequest, res: Response): Promise<void> {
  const parsed = calculateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() });
    return;
  }
  try {
    res.json(await calculateBom(parsed.data));
  } catch (err) { handleError(res, err, 'calculate'); }
}

export async function getBomInputsHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json(await getBomInputsForProduct(req.params.productId as string));
  } catch (err) { handleError(res, err, 'getBomInputs'); }
}
