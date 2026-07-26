import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import {
  listHandler, getByIdHandler, createHandler, updateHandler, cancelHandler, deliverItemHandler,
  getStockHandler, setThresholdHandler, getBatchesHandler,
  getPricingHandler, upsertPricingHandler,
} from '../controllers/purchase-orders.controller';

const router = Router();

router.use(requireAuth);

// ─── purchase orders ──────────────────────────────────────────────────────────
// GET  /purchase-orders?productId=...
// POST /purchase-orders
// GET  /purchase-orders/:id
// PATCH /purchase-orders/:id
// POST /purchase-orders/:id/cancel

// Static-prefix routes MUST come before /:id to avoid being shadowed
router.get('/stock/:productId',             getStockHandler);
router.patch('/stock/:productId/threshold', requireRole('owner', 'admin'), setThresholdHandler);
router.get('/stock/:productId/batches',     getBatchesHandler);
router.get('/pricing/:productId',           getPricingHandler);
router.put('/pricing/:productId',           requireRole('owner', 'admin'), upsertPricingHandler);

// Purchase order CRUD
router.get('/',            listHandler);
router.post('/',           requireRole('owner', 'admin'), createHandler);
router.get('/:id',         getByIdHandler);
router.patch('/:id',       requireRole('owner', 'admin'), updateHandler);
router.post('/:id/cancel',                requireRole('owner', 'admin'), cancelHandler);
router.post('/:id/items/:itemId/deliver', requireRole('owner', 'admin'), deliverItemHandler);

export default router;
