import { Router } from 'express';
import { list, getById, create, update, remove } from '../controllers/users.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/',    requireRole('owner', 'admin'), list);
router.get('/:id', requireRole('owner', 'admin'), getById);
router.post('/',   requireRole('owner', 'admin'), create);
router.patch('/:id', requireRole('owner', 'admin'), update);
router.delete('/:id', requireRole('owner'), remove);

export default router;
