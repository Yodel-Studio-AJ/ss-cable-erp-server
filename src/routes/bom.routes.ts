import { Router } from 'express';
import { calculateHandler, getBomInputsHandler } from '../controllers/bom.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();
router.use(requireAuth);

router.get('/inputs/:productId', getBomInputsHandler);
router.post('/calculate',        calculateHandler);

export default router;
