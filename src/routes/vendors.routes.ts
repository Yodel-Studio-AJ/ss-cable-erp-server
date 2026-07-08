import { Router } from 'express';
import { list, getById, create, update, remove, updateProductGroups, updateBranches } from '../controllers/vendors.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/',     requireRole('owner', 'admin', 'floor_manager'), list);
router.get('/:id',  requireRole('owner', 'admin', 'floor_manager'), getById);
router.post('/',    requireRole('owner', 'admin'), create);
router.patch('/:id', requireRole('owner', 'admin'), update);
router.delete('/:id', requireRole('owner', 'admin'), remove);

// product group assignments (replace all at once)
router.put('/:id/product-groups', requireRole('owner', 'admin'), updateProductGroups);

// branch assignments (replace all at once)
router.put('/:id/branches', requireRole('owner', 'admin'), updateBranches);

export default router;
