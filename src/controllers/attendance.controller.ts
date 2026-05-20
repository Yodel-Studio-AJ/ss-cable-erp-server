import { Response } from 'express';
import { z } from 'zod';
import { getMonthSummary, getDayAttendance, markAttendance, getSettings, updateSetting } from '../services/attendance.service';
import { AppError } from '../lib/app-error';
import type { AuthRequest } from '../middleware/auth.middleware';

const statusEnum = z.enum(['present', 'absent', 'half_day', 'leave']);

const markSchema = z.object({
  date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  records: z.array(z.object({
    userId: z.string().uuid(),
    status: statusEnum,
    note:   z.string().max(500).nullable().optional(),
  })).min(1),
});

const updateSettingSchema = z.object({ isAlwaysPresent: z.boolean() });

function handleError(res: Response, err: unknown, ctx: string): void {
  if (err instanceof AppError) { res.status(err.statusCode).json({ message: err.message }); return; }
  console.error(`[attendance.controller] ${ctx}:`, err);
  res.status(500).json({ message: 'Internal server error' });
}

export async function monthSummary(req: AuthRequest, res: Response): Promise<void> {
  const year  = Number(req.query.year);
  const month = Number(req.query.month);
  if (!year || !month || month < 1 || month > 12) {
    res.status(400).json({ message: 'year and month (1-12) query params are required' });
    return;
  }
  try { res.json(await getMonthSummary(year, month, req.user!)); } catch (err) { handleError(res, err, 'monthSummary'); }
}

export async function dayAttendance(req: AuthRequest, res: Response): Promise<void> {
  const date = req.query.date as string;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ message: 'date query param (YYYY-MM-DD) is required' });
    return;
  }
  try { res.json(await getDayAttendance(date, req.user!)); } catch (err) { handleError(res, err, 'dayAttendance'); }
}

export async function mark(req: AuthRequest, res: Response): Promise<void> {
  const parsed = markSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() }); return; }
  try {
    const count = await markAttendance(parsed.data.date, parsed.data.records, req.user!);
    res.json({ marked: count });
  } catch (err) { handleError(res, err, 'mark'); }
}

export async function settings(req: AuthRequest, res: Response): Promise<void> {
  try { res.json(await getSettings(req.user!)); } catch (err) { handleError(res, err, 'settings'); }
}

export async function patchSetting(req: AuthRequest, res: Response): Promise<void> {
  const parsed = updateSettingSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'isAlwaysPresent (boolean) is required' }); return; }
  try {
    await updateSetting(req.params.userId as string, parsed.data.isAlwaysPresent, req.user!);
    res.status(204).send();
  } catch (err) { handleError(res, err, 'patchSetting'); }
}
