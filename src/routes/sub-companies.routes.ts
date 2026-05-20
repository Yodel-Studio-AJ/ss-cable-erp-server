import { Router } from 'express';
import {
  list, getById, create, update, remove,
  listUsers, addUser, updateMembership, removeUser,
} from '../controllers/sub-companies.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

// sub-company CRUD
router.get('/',     requireRole('owner'), list);
router.get('/:id',  requireRole('owner', 'admin'), getById);
router.post('/',    requireRole('owner'), create);
router.patch('/:id', requireRole('owner'), update);
router.delete('/:id', requireRole('owner'), remove);

// membership management
router.get('/:id/users',             requireRole('owner', 'admin'), listUsers);
router.post('/:id/users',            requireRole('owner', 'admin'), addUser);
router.patch('/:id/users/:userId',   requireRole('owner', 'admin'), updateMembership);
router.delete('/:id/users/:userId',  requireRole('owner', 'admin'), removeUser);

export default router;
