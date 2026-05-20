import { Router } from 'express';
import { monthSummary, dayAttendance, mark, settings, patchSetting } from '../controllers/attendance.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/',           monthSummary);
router.get('/day',        dayAttendance);
router.post('/mark',      requireRole('owner', 'admin', 'floor_manager'), mark);
router.get('/settings',   requireRole('owner', 'admin', 'floor_manager'), settings);
router.patch('/settings/:userId', requireRole('owner', 'admin', 'floor_manager'), patchSetting);

export default router;
