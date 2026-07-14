import { Router } from 'express';
import { list, getById, create, update, remove } from '../controllers/attributes.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/',     list);
router.get('/:id',  getById);
router.post('/',    requireRole('owner', 'admin'), create);
router.patch('/:id', requireRole('owner', 'admin'), update);
router.delete('/:id', requireRole('owner', 'admin'), remove);

export default router;
