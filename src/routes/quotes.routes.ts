import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import {
  listHandler, getByIdHandler, createHandler, updateHandler, addItemHandler, removeItemHandler,
} from '../controllers/quotes.controller';

const router = Router();

router.use(requireAuth);

// GET   /quotes?customerId=...
// POST  /quotes
// GET   /quotes/:id
// PATCH /quotes/:id                 (status transitions, customer, notes, valid-until)
// POST  /quotes/:id/items           (add a line — used directly from the BOM calculator)
// DELETE /quotes/:id/items/:itemId

router.get('/',                  listHandler);
router.post('/',                 requireRole('owner', 'admin', 'floor_manager'), createHandler);
router.get('/:id',               getByIdHandler);
router.patch('/:id',             requireRole('owner', 'admin', 'floor_manager'), updateHandler);
router.post('/:id/items',        requireRole('owner', 'admin', 'floor_manager'), addItemHandler);
router.delete('/:id/items/:itemId', requireRole('owner', 'admin', 'floor_manager'), removeItemHandler);

export default router;
