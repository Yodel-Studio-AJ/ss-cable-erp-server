import { Router } from 'express';
import { listAllHandler } from '../controllers/products.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', listAllHandler);

export default router;
