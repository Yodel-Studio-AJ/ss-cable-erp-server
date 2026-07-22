import { Router } from 'express';
import {
  list, getById, create, update, remove,
  listGroupAttrs, addGroupAttr, updateGroupAttr, removeGroupAttr, reorderGroupAttrs,
  listGroupInputs, addGroupInputHandler, updateGroupInputHandler, removeGroupInputHandler,
} from '../controllers/product-groups.controller';
import {
  listHandler as listProducts,
  getByIdHandler as getProductById,
  createHandler as createProduct,
  updateHandler as updateProduct,
  removeHandler as removeProduct,
} from '../controllers/products.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

// product group CRUD
router.get('/',      list);
router.get('/:id',   getById);
router.post('/',     requireRole('owner', 'admin'), create);
router.patch('/:id', requireRole('owner', 'admin'), update);
router.delete('/:id', requireRole('owner'), remove);

// group-attribute management
router.get   ('/:id/attributes',              listGroupAttrs);
router.post  ('/:id/attributes',              requireRole('owner', 'admin'), addGroupAttr);
router.patch ('/:id/attributes/:pgaId',       requireRole('owner', 'admin'), updateGroupAttr);
router.delete('/:id/attributes/:pgaId',       requireRole('owner', 'admin'), removeGroupAttr);
router.put   ('/:id/attributes/reorder',      requireRole('owner', 'admin'), reorderGroupAttrs);

// BOM inputs (what this group consumes to be produced)
router.get   ('/:id/inputs',                  listGroupInputs);
router.post  ('/:id/inputs',                  requireRole('owner', 'admin'), addGroupInputHandler);
router.patch ('/:id/inputs/:inputId',         requireRole('owner', 'admin'), updateGroupInputHandler);
router.delete('/:id/inputs/:inputId',         requireRole('owner', 'admin'), removeGroupInputHandler);

// Product variants for this group
router.get   ('/:id/products',                listProducts);
router.post  ('/:id/products',                requireRole('owner', 'admin'), createProduct);
router.get   ('/:id/products/:productId',     getProductById);
router.patch ('/:id/products/:productId',     requireRole('owner', 'admin'), updateProduct);
router.delete('/:id/products/:productId',     requireRole('owner', 'admin'), removeProduct);

export default router;
