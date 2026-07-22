import { Router } from 'express';
import { listAllHandler, getByIdGlobalHandler } from '../controllers/products.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', listAllHandler);
router.get('/:id', getByIdGlobalHandler);

export default router;
